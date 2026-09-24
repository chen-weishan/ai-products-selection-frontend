import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, Subscription, exhaustMap, finalize, forkJoin, takeWhile, timer } from 'rxjs';
import {
  ImportBatchResponse, ImportDataType, ImportField, ImportMappingTemplate,
  ImportPreviewResponse, ImportTaskStatus, ImportUploadResponse,
} from './import.models';
import { ImportService } from './import.service';

interface DataTypeOption {
  value: ImportDataType;
  label: string;
  description: string;
}

@Component({
  selector: 'app-imports',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, MatButtonModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule, MatTooltipModule],
  templateUrl: './imports.component.html',
  styleUrl: './imports.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportsComponent implements OnInit {
  private readonly importService = inject(ImportService);
  private readonly destroyRef = inject(DestroyRef);
  private pollSubscription?: Subscription;

  formatMix(mix: Record<string, number>): string {
    return Object.entries(mix).map(([code, share]) => `${code} ${(share * 100).toFixed(1)}%`).join('、') || '尚未設定';
  }

  readonly dataTypes: DataTypeOption[] = [
    { value: 'SALES', label: '歷史銷售', description: '品項、通路、日期、銷售量與金額' },
    { value: 'REVIEW', label: '商品評論', description: '評論內容、評分與評論日期' },
    { value: 'AUDIENCE', label: '會員輪廓', description: '去識別化的客群屬性與偏好' },
    { value: 'PRODUCT', label: '品項主檔', description: '品項編號、名稱、分類與售價' },
  ];
  readonly dataTypeControl = new FormControl<ImportDataType>('SALES', { nonNullable: true });
  readonly templateControl = new FormControl<number | null>(null);
  readonly templateNameControl = new FormControl('', { nonNullable: true });

  readonly step = signal<1 | 2 | 3 | 4>(1);
  readonly fields = signal<ImportField[]>([]);
  readonly templates = signal<ImportMappingTemplate[]>([]);
  readonly selectedFile = signal<File | null>(null);
  readonly dragging = signal(false);
  readonly uploadResult = signal<ImportUploadResponse | null>(null);
  readonly mappings = signal<Record<string, string>>({});
  readonly previewResult = signal<ImportPreviewResponse | null>(null);
  readonly batchResult = signal<ImportBatchResponse | null>(null);
  readonly history = signal<ImportBatchResponse[]>([]);
  readonly busy = signal(false);
  readonly referenceLoading = signal(false);
  readonly historyLoading = signal(false);
  readonly polling = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly missingRequiredFields = computed(() => {
    const targets = new Set(Object.values(this.mappings()));
    return this.fields().filter((field) => field.required && !targets.has(field.key));
  });
  readonly duplicateTargets = computed(() => {
    const targets = Object.values(this.mappings()).filter(Boolean);
    return [...new Set(targets.filter((target, index) => targets.indexOf(target) !== index))];
  });
  readonly mappingValid = computed(() =>
    this.missingRequiredFields().length === 0 && this.duplicateTargets().length === 0);
  readonly previewColumns = computed(() => {
    const targets = new Set(Object.values(this.mappings()).filter(Boolean));
    return this.fields().filter((field) => targets.has(field.key));
  });

  ngOnInit(): void {
    this.dataTypeControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.resetWorkflow();
      this.loadReferenceData();
    });
    this.loadReferenceData();
    this.loadHistory();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (file) this.acceptFile(file);
    input.value = '';
  }
  onDragOver(event: DragEvent): void { event.preventDefault(); this.dragging.set(true); }
  onDragLeave(event: DragEvent): void { event.preventDefault(); this.dragging.set(false); }
  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files.item(0);
    if (file) this.acceptFile(file);
  }
  removeFile(): void { this.selectedFile.set(null); this.clearMessages(); }

  upload(): void {
    const file = this.selectedFile();
    if (!file || this.busy()) return;
    this.busy.set(true);
    this.clearMessages();
    this.importService.upload(this.dataTypeControl.value, file)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.uploadResult.set(result);
          this.mappings.set(result.mappingSuggestions.reduce<Record<string, string>>((all, item) => {
            if (item.status === 'AUTO_MAPPED' && item.systemField) all[item.sourceHeader] = item.systemField;
            return all;
          }, {}));
          this.step.set(2);
          this.successMessage.set('檔案已解析，請確認欄位對應。');
        },
        error: (error) => this.showError(error, '上傳檔案失敗'),
      });
  }

  mappingValue(header: string): string { return this.mappings()[header] ?? ''; }
  setMapping(header: string, target: string): void {
    this.mappings.update((current) => {
      const next = { ...current };
      if (target) next[header] = target;
      else delete next[header];
      return next;
    });
    this.previewResult.set(null);
    this.clearMessages();
  }
  targetUsedByOther(target: string, header: string): boolean {
    return Object.entries(this.mappings()).some(([source, value]) => source !== header && value === target);
  }
  suggestionLabel(header: string): string {
    const item = this.uploadResult()?.mappingSuggestions.find((value) => value.sourceHeader === header);
    if (!item) return '未辨識';
    if (item.status === 'BLOCKED_PERSONAL_DATA') return '疑似個資，已封鎖';
    if (item.status === 'AUTO_MAPPED') return `系統建議 ${Math.round(item.confidence * 100)}%`;
    return '請手動對應';
  }
  suggestionClass(header: string): string {
    const status = this.uploadResult()?.mappingSuggestions.find((item) => item.sourceHeader === header)?.status;
    return status === 'BLOCKED_PERSONAL_DATA' ? 'blocked' : status === 'AUTO_MAPPED' ? 'matched' : '';
  }

  applyTemplate(templateId: number | null): void {
    const template = this.templates().find((item) => item.id === templateId);
    const upload = this.uploadResult();
    if (!template || !upload) return;
    const headers = new Set(upload.headers);
    const fields = new Set(this.fields().map((field) => field.key));
    const mappings = Object.entries(template.mappings).reduce<Record<string, string>>((all, [source, target]) => {
      if (headers.has(source) && fields.has(target)) all[source] = target;
      return all;
    }, {});
    this.mappings.set(mappings);
    this.templateNameControl.setValue(template.name);
    this.successMessage.set(`已套用「${template.name}」。`);
  }

  saveTemplate(): void {
    const name = this.templateNameControl.value.trim();
    if (!name) { this.errorMessage.set('請輸入範本名稱。'); return; }
    if (!Object.keys(this.mappings()).length) { this.errorMessage.set('至少需要一組欄位對應才能儲存範本。'); return; }
    const request = { name, dataType: this.dataTypeControl.value, mappings: this.mappings() };
    const id = this.templateControl.value;
    const operation = id ? this.importService.updateTemplate(id, request) : this.importService.createTemplate(request);
    this.busy.set(true);
    this.clearMessages();
    operation.pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (template) => {
        this.templateControl.setValue(template.id, { emitEvent: false });
        this.successMessage.set(id ? '欄位範本已更新。' : '欄位範本已建立。');
        this.loadTemplates();
      },
      error: (error) => this.showError(error, '儲存範本失敗'),
    });
  }

  deleteTemplate(): void {
    const id = this.templateControl.value;
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.clearMessages();
    this.importService.deleteTemplate(id)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.templateControl.setValue(null);
          this.templateNameControl.setValue('');
          this.successMessage.set('欄位範本已刪除。');
          this.loadTemplates();
        },
        error: (error) => this.showError(error, '刪除範本失敗'),
      });
  }

  preview(): void {
    const upload = this.uploadResult();
    if (!upload || !this.mappingValid() || this.busy()) return;
    this.busy.set(true);
    this.clearMessages();
    this.importService.preview(upload.batchId, this.mappings())
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => { this.previewResult.set(result); this.step.set(3); },
        error: (error) => this.showError(error, '建立資料預覽失敗'),
      });
  }

  confirmImport(): void {
    const upload = this.uploadResult();
    if (!upload || this.busy()) return;
    this.busy.set(true);
    this.clearMessages();
    this.importService.confirm(upload.batchId, this.mappings())
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.batchResult.set(result);
          this.step.set(4);
          if (this.needsUpdates(result)) this.startPolling(result.batchId); else this.loadHistory();
        },
        error: (error) => this.showError(error, '開始匯入失敗'),
      });
  }

  backToMapping(): void { this.step.set(2); this.clearMessages(); }
  newImport(): void { this.resetWorkflow(); this.loadReferenceData(); }
  viewBatch(batch: ImportBatchResponse): void {
    this.pollSubscription?.unsubscribe();
    this.batchResult.set(batch);
    this.step.set(4);
    this.clearMessages();
    if (this.needsUpdates(batch)) {
      this.startPolling(batch.batchId);
    } else if (batch.status !== 'PENDING') {
      this.importService.batch(batch.batchId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (detail) => {
          if (this.batchResult()?.batchId === batch.batchId) { this.batchResult.set(detail); if(this.needsUpdates(detail)) this.startPolling(detail.batchId); }
        },
        error: (error) => this.showError(error, '讀取匯入結果失敗'),
      });
    }
  }
  resumePending(batch: ImportBatchResponse): void {
    if (this.busy()) return;
    if (this.uploadResult()?.batchId === batch.batchId) {
      this.backToMapping();
      return;
    }
    this.busy.set(true);
    this.clearMessages();
    this.importService.resumePending(batch.batchId)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (upload) => {
          this.dataTypeControl.setValue(upload.dataType);
          this.uploadResult.set(upload);
          const suggested = upload.mappingSuggestions.reduce<Record<string, string>>((all, item) => {
            if (item.status === 'AUTO_MAPPED' && item.systemField) all[item.sourceHeader] = item.systemField;
            return all;
          }, {});
          this.mappings.set(upload.savedMappings && Object.keys(upload.savedMappings).length
            ? { ...upload.savedMappings } : suggested);
          this.step.set(2);
          this.successMessage.set('已恢復待確認的匯入，請檢查欄位對應。');
        },
        error: (error) => this.showError(error, '無法接續此匯入，請重新上傳檔案'),
      });
  }
  downloadPreviewErrors(): void {
    const preview = this.previewResult();
    if (preview) this.download(this.importService.downloadPreviewErrors(preview.batchId, this.mappings()), `import-preview-errors-${preview.batchId}.csv`);
  }
  downloadBatchErrors(batch: ImportBatchResponse): void {
    this.download(this.importService.downloadErrors(batch.batchId), `import-errors-${batch.batchId}.csv`);
  }

  downloadUnprocessed(batch: ImportBatchResponse): void {
    this.download(this.importService.downloadUnprocessed(batch.batchId), `import-unprocessed-${batch.batchId}.csv`);
  }
  retryRecalculation(batch: ImportBatchResponse): void {
    if(this.busy()) return;
    this.busy.set(true);
    this.importService.retryRecalculation(batch.batchId)
      .pipe(finalize(() => this.busy.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({next: () => this.startPolling(batch.batchId), error: error => this.showError(error, '重試評分更新失敗')});
  }
  private needsUpdates(batch: ImportBatchResponse): boolean {
    return this.isActive(batch.status) || (batch.recalculation?.['PENDING'] ?? 0) > 0;
  }

  dataTypeLabel(type: ImportDataType): string { return this.dataTypes.find((item) => item.value === type)?.label ?? type; }
  statusLabel(status: ImportTaskStatus): string {
    return ({ PENDING: '尚未確認', RUNNING: '匯入中', SUCCEEDED: '已完成', FAILED: '失敗',
      PARTIAL: '部分完成', CANCELLED: '已取消' } as Record<ImportTaskStatus, string>)[status];
  }
  statusClass(status: ImportTaskStatus): string {
    if (status === 'SUCCEEDED') return 'success';
    if (status === 'FAILED' || status === 'CANCELLED') return 'danger';
    if (status === 'PARTIAL') return 'warning';
    return 'info';
  }
  fieldLabel(key?: string): string {
    return key ? this.fields().find((field) => field.key === key)?.label ?? key : '';
  }

  private acceptFile(file: File): void {
    this.clearMessages();
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['csv', 'xlsx'].includes(extension)) {
      this.selectedFile.set(null);
      this.errorMessage.set('僅支援 CSV 或 XLSX 檔案。');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      this.selectedFile.set(null);
      this.errorMessage.set('檔案不可超過 50 MB。');
      return;
    }
    this.selectedFile.set(file);
  }
  private loadReferenceData(): void {
    this.referenceLoading.set(true);
    forkJoin({ fields: this.importService.fields(this.dataTypeControl.value), templates: this.importService.templates(this.dataTypeControl.value) })
      .pipe(finalize(() => this.referenceLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ fields, templates }) => { this.fields.set(fields); this.templates.set(templates); },
        error: (error) => this.showError(error, '讀取匯入欄位設定失敗'),
      });
  }
  private loadTemplates(): void {
    this.importService.templates(this.dataTypeControl.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (templates) => this.templates.set(templates),
      error: (error) => this.showError(error, '讀取欄位範本失敗'),
    });
  }
  loadHistory(): void {
    this.historyLoading.set(true);
    this.importService.batches(0, 20)
      .pipe(finalize(() => this.historyLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.history.set(page.content),
        error: (error) => this.showError(error, '讀取匯入紀錄失敗'),
      });
  }
  private startPolling(batchId: number): void {
    this.pollSubscription?.unsubscribe();
    this.polling.set(true);
    this.pollSubscription = timer(0, 2000).pipe(
      exhaustMap(() => this.importService.batch(batchId)),
      takeWhile((batch) => this.needsUpdates(batch), true),
      finalize(() => this.polling.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (batch) => { this.batchResult.set(batch); if (!this.needsUpdates(batch)) this.loadHistory(); },
      error: (error) => this.showError(error, '更新匯入進度失敗'),
    });
  }
  private isActive(status: ImportTaskStatus): boolean { return status === 'RUNNING'; }
  private download(source: Observable<Blob>, fileName: string): void {
    this.clearMessages();
    source.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: (error) => this.showError(error, '下載錯誤明細失敗'),
    });
  }
  private resetWorkflow(): void {
    this.pollSubscription?.unsubscribe();
    this.step.set(1);
    this.selectedFile.set(null);
    this.uploadResult.set(null);
    this.mappings.set({});
    this.previewResult.set(null);
    this.batchResult.set(null);
    this.templateControl.setValue(null, { emitEvent: false });
    this.templateNameControl.setValue('');
    this.clearMessages();
  }
  private clearMessages(): void { this.errorMessage.set(''); this.successMessage.set(''); }
  private showError(error: unknown, fallback: string): void {
    this.errorMessage.set(error instanceof Error && error.message ? error.message : fallback);
  }
}
