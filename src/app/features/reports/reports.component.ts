import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription, timer } from 'rxjs';
import {
  ReportCategoryOption,
  ReportDecisionMakerOption,
  ReportFormat,
  ReportGenerateRequest,
  ReportJob,
  ReportType,
} from './report.models';
import { ReportService } from './report.service';
import { ReportEventsService, ReportStreamEvent } from './report-events.service';

interface ReportDefinition {
  type: ReportType;
  title: string;
  description: string;
  format: ReportFormat;
  icon: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'zh-TW' },
    provideNativeDateAdapter(),
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent implements OnInit {
  private readonly reportsService = inject(ReportService);
  private readonly reportEvents = inject(ReportEventsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly definitions: ReportDefinition[] = [
    { type: 'WEEKLY_PICK', title: '週選品建議', description: '四榜各 Top 10、AI 建議摘要與風險示警清單。', format: 'PDF', icon: 'leaderboard' },
    { type: 'SCORE_DETAIL', title: '品項評分明細', description: '全品項六因子原始值、百分位與加減分明細。', format: 'XLSX', icon: 'table_view' },
    { type: 'ACCURACY', title: '決策準確度', description: '五項準確度指標與每月趨勢；樣本不足時保留效度警示。', format: 'PDF', icon: 'monitoring' },
    { type: 'SOURCING_QUEUE', title: '尋源優先序', description: 'B 軌候選清單與時效落差，依急迫程度排序。', format: 'XLSX', icon: 'travel_explore' },
    { type: 'CALIBRATION', title: '權重校準紀錄', description: '歷次校準建議、統計效度與核准結果。', format: 'PDF', icon: 'tune' },
  ];

  private readonly initialPeriod = this.currentIsoWeek();
  readonly periodYear = new FormControl(
    { value: this.initialPeriod.year, disabled: true },
    { nonNullable: true },
  );
  readonly periodWeek = new FormControl(
    { value: this.initialPeriod.week, disabled: true },
    { nonNullable: true },
  );
  readonly periodYears = signal<number[]>([]);
  readonly periodWeeks = signal<number[]>([]);
  readonly hasScorePeriods = signal(false);
  readonly categoryId = new FormControl<number | null>(null);
  readonly accuracyFrom = new FormControl(this.monthsAgo(12), { nonNullable: true });
  readonly accuracyTo = new FormControl(new Date(), { nonNullable: true });
  readonly decisionMakerId = new FormControl<number | null>(null);
  readonly sourcingStatus = new FormControl('', { nonNullable: true });
  readonly fromQuarter = new FormControl('', { nonNullable: true });
  readonly toQuarter = new FormControl('', { nonNullable: true });
  readonly calibrationStatus = new FormControl('', { nonNullable: true });

  readonly jobs = signal<ReportJob[]>([]);
  readonly categories = signal<ReportCategoryOption[]>([]);
  readonly decisionMakers = signal<ReportDecisionMakerOption[]>([]);
  readonly calibrationQuarters = signal<string[]>([]);
  readonly loading = signal(true);
  readonly filterOptionsLoading = signal(true);
  readonly generating = signal<ReportType | null>(null);
  readonly downloading = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly activeCount = computed(() => this.jobs().filter(job => this.isActive(job)).length);
  private readonly priorStatuses = new Map<number, ReportJob['status']>();
  private readonly scorePeriodsByYear = new Map<number, number[]>();
  private readonly availableScorePeriods = new Set<string>();
  private successDismissSubscription?: Subscription;

  ngOnInit(): void {
    this.loadReports('取得報表紀錄失敗');
    this.loadFilterOptions();
    this.watchReportEvents();
  }

  generate(definition: ReportDefinition): void {
    this.clearMessages();
    if (!this.canGenerate(definition)) {
      this.errorMessage.set('目前沒有可供報表使用的評分期別。');
      return;
    }
    this.generating.set(definition.type);
    const request: ReportGenerateRequest = {
      reportType: definition.type,
      format: definition.format,
      params: this.paramsFor(definition.type),
    };
    this.reportsService.generate(request)
      .pipe(
        finalize(() => this.generating.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: job => {
          this.jobs.update(items => [job, ...items.filter(item => item.id !== job.id)]);
          this.priorStatuses.set(job.id, job.status);
          this.showSuccess(job.status === 'SUCCEEDED'
            ? `${definition.title}已產生，可立即下載。`
            : `${definition.title}已排入背景產生，完成後會在下方顯示下載按鈕。`);
        },
        error: error => this.showError(error, '建立報表任務失敗'),
      });
  }

  refresh(): void {
    this.clearMessages();
    this.loadReports('更新報表紀錄失敗');
  }

  dismissSuccess(): void {
    this.successDismissSubscription?.unsubscribe();
    this.successDismissSubscription = undefined;
    this.successMessage.set('');
  }

  private loadReports(errorFallback: string): void {
    this.loading.set(true);
    this.reportsService.list(0, 20)
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.notifyCompleted(page.content);
          this.jobs.set(page.content);
        },
        error: error => this.showError(error, errorFallback),
      });
  }

  private loadFilterOptions(): void {
    this.filterOptionsLoading.set(true);
    this.reportsService.filterOptions()
      .pipe(
        finalize(() => this.filterOptionsLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: options => {
          this.categories.set(options.categories);
          this.decisionMakers.set(options.decisionMakers);
          this.setScorePeriods(options.scorePeriods);
          this.calibrationQuarters.set(options.calibrationQuarters);
        },
        error: error => this.showError(error, '取得報表條件選項失敗'),
      });
  }

  private watchReportEvents(): void {
    this.reportEvents.watch()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: event => this.applyStreamEvent(event),
        error: () => this.errorMessage.set(
          '報表即時更新連線失敗；報表仍會繼續產生，可使用重新整理查詢狀態。',
        ),
      });
  }

  private applyStreamEvent(event: ReportStreamEvent): void {
    if (event.type === 'connected') {
      this.loadReports('同步報表狀態失敗');
      return;
    }
    this.notifyCompleted([event.job]);
    this.jobs.update(items => {
      const index = items.findIndex(item => item.id === event.job.id);
      if (index < 0) return [event.job, ...items];
      return items.map(item => item.id === event.job.id ? event.job : item);
    });
  }

  download(job: ReportJob): void {
    if (!job.downloadable) return;
    this.clearMessages();
    this.downloading.set(job.id);
    this.reportsService.download(job.id)
      .pipe(finalize(() => this.downloading.set(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => this.saveDownload(response, job.fileName ?? `report-${job.id}.${job.format.toLowerCase()}`),
        error: error => this.showError(error, '下載報表失敗'),
      });
  }

  reportLabel(type: ReportType): string {
    return this.definitions.find(item => item.type === type)?.title ?? type;
  }

  statusLabel(job: ReportJob): string {
    return {
      PENDING: '等待中',
      RUNNING: '產生中',
      SUCCEEDED: '完成',
      FAILED: '失敗',
      PARTIAL: '部分完成',
      CANCELLED: '已取消',
    }[job.status];
  }

  statusClass(job: ReportJob): string {
    return job.status.toLowerCase();
  }

  isActive(job: ReportJob): boolean {
    return job.status === 'PENDING' || job.status === 'RUNNING';
  }

  filterSummary(job: ReportJob): string {
    const params = job.params ?? {};
    const values: string[] = [];
    if (params['period']) values.push(String(params['period']));
    if (params['from'] || params['to']) values.push(`${params['from'] ?? '—'} ～ ${params['to'] ?? '—'}`);
    if (params['fromQuarter'] || params['toQuarter']) values.push(`${params['fromQuarter'] ?? '全部'} ～ ${params['toQuarter'] ?? '全部'}`);
    if (params['categoryId']) {
      const id = Number(params['categoryId']);
      const category = this.categories().find(option => option.id === id);
      values.push(category?.label ?? `類別 #${id}`);
    }
    if (params['decisionMakerId']) {
      const id = Number(params['decisionMakerId']);
      const decisionMaker = this.decisionMakers().find(option => option.id === id);
      values.push(decisionMaker?.displayName ?? `決策者 #${id}`);
    }
    if (params['status']) values.push(String(params['status']));
    return values.join('・') || '全部資料';
  }

  fileSize(bytes?: number | null): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  periodLabel(): string {
    if (!this.hasScorePeriods()) {
      return this.filterOptionsLoading() ? '載入期別中…' : '目前沒有評分資料';
    }
    return `${this.periodYear.value} 年第 ${this.periodWeek.value} 週`;
  }

  onPeriodYearChange(year: number): void {
    const weeks = this.scorePeriodsByYear.get(year) ?? [];
    this.periodWeeks.set(weeks);
    if (!weeks.includes(this.periodWeek.value) && weeks.length > 0) {
      this.periodWeek.setValue(weeks[0]);
    }
  }

  canGenerate(definition: ReportDefinition): boolean {
    if (definition.type !== 'WEEKLY_PICK' && definition.type !== 'SCORE_DETAIL') {
      return true;
    }
    return this.availableScorePeriods.has(this.selectedScorePeriod());
  }

  private paramsFor(type: ReportType): Record<string, string | number> {
    const common: Record<string, string | number> = {};
    if (this.categoryId.value != null) common['categoryId'] = this.categoryId.value;
    if (type === 'WEEKLY_PICK' || type === 'SCORE_DETAIL') {
      return { ...common, period: this.selectedScorePeriod() };
    }
    if (type === 'ACCURACY') {
      const params: Record<string, string | number> = {
        ...common,
        from: this.localDate(this.accuracyFrom.value),
        to: this.localDate(this.accuracyTo.value),
      };
      if (this.decisionMakerId.value != null) params['decisionMakerId'] = this.decisionMakerId.value;
      return params;
    }
    if (type === 'SOURCING_QUEUE') {
      return this.sourcingStatus.value ? { ...common, status: this.sourcingStatus.value } : common;
    }
    const params: Record<string, string | number> = {};
    if (this.fromQuarter.value.trim()) params['fromQuarter'] = this.fromQuarter.value.trim();
    if (this.toQuarter.value.trim()) params['toQuarter'] = this.toQuarter.value.trim();
    if (this.calibrationStatus.value) params['status'] = this.calibrationStatus.value;
    return params;
  }

  private notifyCompleted(items: ReportJob[]): void {
    for (const job of items) {
      const previous = this.priorStatuses.get(job.id);
      if ((previous === 'PENDING' || previous === 'RUNNING') && job.status === 'SUCCEEDED') {
        this.showSuccess(`${this.reportLabel(job.reportType)}已完成，可下載。`);
      }
      this.priorStatuses.set(job.id, job.status);
    }
  }

  private saveDownload(response: HttpResponse<Blob>, fallbackName: string): void {
    const disposition = response.headers.get('content-disposition') ?? '';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    const quoted = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
    const fileName = encoded ? decodeURIComponent(encoded) : quoted ?? fallbackName;
    const blob = response.body ?? new Blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    this.showSuccess('報表下載完成。');
  }

  private clearMessages(): void {
    this.errorMessage.set('');
    this.dismissSuccess();
  }

  private showSuccess(message: string): void {
    this.successDismissSubscription?.unsubscribe();
    this.successMessage.set(message);
    this.successDismissSubscription = timer(5_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.successMessage.set('');
        this.successDismissSubscription = undefined;
      });
  }

  private showError(error: unknown, fallback: string): void {
    this.errorMessage.set(error instanceof Error && error.message ? error.message : fallback);
  }

  private localDate(date = new Date()): string {
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  private monthsAgo(months: number): Date {
    const date = new Date();
    date.setMonth(date.getMonth() - months);
    return date;
  }

  private setScorePeriods(periods: string[]): void {
    this.scorePeriodsByYear.clear();
    this.availableScorePeriods.clear();

    for (const rawPeriod of periods) {
      const period = rawPeriod.trim();
      const match = /^(\d{4})W(0[1-9]|[1-4]\d|5[0-3])$/.exec(period);
      if (!match || this.availableScorePeriods.has(period)) continue;

      const year = Number(match[1]);
      const week = Number(match[2]);
      this.availableScorePeriods.add(period);
      const weeks = this.scorePeriodsByYear.get(year) ?? [];
      weeks.push(week);
      this.scorePeriodsByYear.set(year, weeks);
    }

    const years = [...this.scorePeriodsByYear.keys()].sort((left, right) => right - left);
    for (const year of years) {
      this.scorePeriodsByYear.set(
        year,
        [...new Set(this.scorePeriodsByYear.get(year))].sort((left, right) => right - left),
      );
    }
    this.periodYears.set(years);

    if (years.length === 0) {
      this.periodWeeks.set([]);
      this.hasScorePeriods.set(false);
      this.periodYear.disable({ emitEvent: false });
      this.periodWeek.disable({ emitEvent: false });
      return;
    }

    const latestYear = years[0];
    const latestWeek = this.scorePeriodsByYear.get(latestYear)![0];
    this.periodYear.setValue(latestYear, { emitEvent: false });
    this.periodWeek.setValue(latestWeek, { emitEvent: false });
    this.periodWeeks.set(this.scorePeriodsByYear.get(latestYear)!);
    this.periodYear.enable({ emitEvent: false });
    this.periodWeek.enable({ emitEvent: false });
    this.hasScorePeriods.set(true);
  }

  private selectedScorePeriod(): string {
    return `${this.periodYear.value}W${String(this.periodWeek.value).padStart(2, '0')}`;
  }

  private currentIsoWeek(): { year: number; week: number } {
    const date = new Date();
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
    return { year: utc.getUTCFullYear(), week };
  }

}
