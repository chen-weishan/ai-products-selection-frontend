import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { filter, finalize, forkJoin, switchMap } from 'rxjs';
import { DialogService } from '../../services/dialog-service';
import { AdminAiSettingsComponent } from './ai-settings/admin-ai-settings.component';
import { AdminRiskRulesComponent } from './risk-rules/admin-risk-rules.component';
import { AdminSchedulesComponent } from './schedules/admin-schedules.component';
import { AdminRecoverySettingsComponent } from './recovery/admin-recovery-settings.component';
import { AdminUsersComponent } from './users/admin-users.component';
import {
  CategoryNode,
  MasterDataService,
  SupplierRecord,
} from './master-data.service';
import { OperationalRuntimeConfig, RuntimeSettingsService } from './runtime-settings.service';

interface FlatCategory {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  sortOrder: number;
  depth: number;
  hasChildren: boolean;
}

/** 情境信心門檻以百分比編輯，存檔時轉回 0～1。 */
interface OperationalDraft extends Omit<OperationalRuntimeConfig, 'sceneAdoptConfidence' | 'sceneScoringConfidence'> {
  sceneAdoptPercent: number;
  sceneScoringPercent: number;
}

@Component({
  selector: 'app-admin',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    RouterLink,
    AdminUsersComponent,
    AdminAiSettingsComponent,
    AdminSchedulesComponent,
    AdminRecoverySettingsComponent,
    AdminRiskRulesComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin-shared.scss', './admin.component.scss'],
})
export class AdminComponent {
  private readonly api = inject(MasterDataService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogs = inject(DialogService);
  private readonly runtimeSettings = inject(RuntimeSettingsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  /** 分頁順序以 ?tab= 記住位置，方便從別頁直接連過來。 */
  readonly tabKeys = ['users', 'ai', 'schedules', 'recovery', 'risk-rules', 'operational', 'categories', 'suppliers', 'heat-sources', 'festivals'];
  readonly selectedTab = signal(Math.max(0, this.tabKeys.indexOf(this.route.snapshot.queryParamMap.get('tab') ?? '')));
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly categories = signal<CategoryNode[]>([]);
  readonly suppliers = signal<SupplierRecord[]>([]);
  readonly editingCategoryId = signal<number | null>(null);
  readonly editingSupplierId = signal<number | null>(null);
  operationalConfig: OperationalDraft | null = null;
  private savedOperational: OperationalDraft | null = null;
  readonly flatCategories = computed(() => flattenCategories(this.categories()));
  readonly rootCategories = computed(() =>
    this.categories().filter((category) => category.id !== this.editingCategoryId()),
  );

  readonly categoryForm = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(50)]),
    parentId: this.fb.control<number | null>(null),
    sortOrder: this.fb.nonNullable.control(0, [Validators.required, Validators.min(0)]),
  });

  readonly supplierForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    contact: ['', Validators.maxLength(50)],
    phone: ['', Validators.maxLength(30)],
    note: ['', Validators.maxLength(500)],
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      categories: this.api.categories(),
      suppliers: this.api.suppliers(),
      operationalConfig: this.runtimeSettings.getOperationalConfig(),
    })
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ categories, suppliers, operationalConfig }) => {
          this.categories.set(categories);
          this.suppliers.set(suppliers);
          this.setOperational(operationalConfig);
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  selectTab(index: number): void {
    this.selectedTab.set(index);
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: this.tabKeys[index] }, replaceUrl: true });
  }

  newCategory(): void {
    this.editingCategoryId.set(null);
    this.categoryForm.reset({ name: '', parentId: null, sortOrder: 0 });
  }

  editCategory(category: FlatCategory): void {
    this.editingCategoryId.set(category.id);
    this.categoryForm.reset({
      name: category.name,
      parentId: category.parentId,
      sortOrder: category.sortOrder,
    });
  }

  saveCategory(): void {
    if (this.categoryForm.invalid || this.saving()) {
      this.categoryForm.markAllAsTouched();
      return;
    }
    const id = this.editingCategoryId();
    const value = this.categoryForm.getRawValue();
    const operation = id == null
      ? this.api.createCategory({ ...value, name: value.name.trim() })
      : this.api.updateCategory(id, { ...value, name: value.name.trim() });
    this.saving.set(true);
    this.error.set(null);
    operation
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.showSuccess(id == null ? `已新增類別「${saved.name}」` : `已更新類別「${saved.name}」`);
          this.newCategory();
          this.reloadCategories();
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  deleteCategory(): void {
    const id = this.editingCategoryId();
    const category = this.flatCategories().find((item) => item.id === id);
    if (id == null || category == null || this.saving()) return;

    this.dialogs.Confirm({
      title: '刪除類別',
      message: `確定要刪除「${category.name}」嗎？有子類別或仍被品項使用時將無法刪除。`,
      confirmText: '確認刪除',
      cancelText: '取消',
      isDanger: true,
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        this.saving.set(true);
        this.error.set(null);
        return this.api.deleteCategory(id).pipe(finalize(() => this.saving.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.showSuccess(`已刪除類別「${category.name}」`);
        this.newCategory();
        this.reloadCategories();
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }

  newSupplier(): void {
    this.editingSupplierId.set(null);
    this.supplierForm.reset({ name: '', contact: '', phone: '', note: '' });
  }

  editSupplier(supplier: SupplierRecord): void {
    this.editingSupplierId.set(supplier.id);
    this.supplierForm.reset({
      name: supplier.name,
      contact: supplier.contact ?? '',
      phone: supplier.phone ?? '',
      note: supplier.note ?? '',
    });
  }

  saveSupplier(): void {
    if (this.supplierForm.invalid || this.saving()) {
      this.supplierForm.markAllAsTouched();
      return;
    }
    const id = this.editingSupplierId();
    const value = this.supplierForm.getRawValue();
    const request = {
      name: value.name.trim(),
      contact: nullable(value.contact),
      phone: nullable(value.phone),
      note: nullable(value.note),
    };
    const operation = id == null
      ? this.api.createSupplier(request)
      : this.api.updateSupplier(id, request);
    this.saving.set(true);
    this.error.set(null);
    operation
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.showSuccess(id == null ? `已新增供應商「${saved.name}」` : `已更新供應商「${saved.name}」`);
          this.newSupplier();
          this.reloadSuppliers();
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  deleteSupplier(): void {
    const id = this.editingSupplierId();
    const supplier = this.suppliers().find((item) => item.id === id);
    if (id == null || supplier == null || this.saving()) return;

    this.dialogs.Confirm({
      title: '刪除供應商',
      message: `確定要刪除「${supplier.name}」嗎？仍被品項使用時將無法刪除。`,
      confirmText: '確認刪除',
      cancelText: '取消',
      isDanger: true,
    }).pipe(
      filter(Boolean),
      switchMap(() => {
        this.saving.set(true);
        this.error.set(null);
        return this.api.deleteSupplier(id).pipe(finalize(() => this.saving.set(false)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.showSuccess(`已刪除供應商「${supplier.name}」`);
        this.newSupplier();
        this.reloadSuppliers();
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }

  dismissMessage(): void {
    this.success.set(null);
    this.error.set(null);
  }

  operationalDirty(): boolean {
    return this.operationalConfig != null
      && JSON.stringify(this.operationalConfig) !== JSON.stringify(this.savedOperational);
  }

  resetOperational(): void {
    if (this.savedOperational) this.operationalConfig = structuredClone(this.savedOperational);
  }

  operationalErrors(): string[] {
    const config = this.operationalConfig;
    if (config == null) return [];
    const errors: string[] = [];
    const positive = [
      config.loginMaxFailedAttempts, config.loginLockDurationMinutes, config.heatTagHalveAfterDays,
      config.scoringMinCategorySample, config.calibrationMinSample,
    ];
    if (positive.some((value) => !(value >= 1) || !Number.isInteger(value))) errors.push('次數、分鐘、天數與樣本數須為正整數');
    if (!(config.heatTagExpireDays > config.heatTagHalveAfterDays)) errors.push('人工熱度失效天數須大於減半天數');
    const inRange = (value: number) => value >= 0 && value <= 100;
    if (!inRange(config.sceneAdoptPercent) || !inRange(config.sceneScoringPercent)) errors.push('情境信心門檻須介於 0%～100%');
    else if (config.sceneScoringPercent < config.sceneAdoptPercent) errors.push('情境計分門檻不得低於採用門檻');
    return errors;
  }

  saveOperationalConfig(): void {
    const draft = this.operationalConfig;
    if (draft == null || this.saving() || this.operationalErrors().length) return;
    const { sceneAdoptPercent, sceneScoringPercent, ...rest } = draft;
    const request: OperationalRuntimeConfig = {
      ...rest,
      sceneAdoptConfidence: Math.round(sceneAdoptPercent * 10) / 1000,
      sceneScoringConfidence: Math.round(sceneScoringPercent * 10) / 1000,
    };
    this.runSave(
      this.runtimeSettings.updateOperationalConfig(request),
      '營運參數已儲存並立即生效',
      (saved) => this.setOperational(saved),
    );
  }

  private setOperational(config: OperationalRuntimeConfig): void {
    const { sceneAdoptConfidence, sceneScoringConfidence, ...rest } = config;
    this.savedOperational = {
      ...rest,
      sceneAdoptPercent: Math.round(Number(sceneAdoptConfidence) * 1000) / 10,
      sceneScoringPercent: Math.round(Number(sceneScoringConfidence) * 1000) / 10,
    };
    this.operationalConfig = structuredClone(this.savedOperational);
  }

  private reloadCategories(): void {
    this.api.categories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: (error: Error) => this.error.set(error.message),
      });
  }

  private reloadSuppliers(): void {
    this.api.suppliers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (suppliers) => this.suppliers.set(suppliers),
        error: (error: Error) => this.error.set(error.message),
      });
  }

  private showSuccess(message: string): void {
    this.success.set(message);
    if (this.successTimer != null) clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => this.success.set(null), 5000);
  }

  private runSave<T>(operation: import('rxjs').Observable<T>, message: string, onSaved?: (value: T) => void): void {
    this.saving.set(true);
    this.error.set(null);
    operation.pipe(
      finalize(() => this.saving.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (value) => {
        onSaved?.(value);
        this.showSuccess(message);
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }
}

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
  parentId: number | null = null,
  parentName: string | null = null,
): FlatCategory[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      name: node.name,
      parentId,
      parentName,
      sortOrder: node.sortOrder,
      depth,
      hasChildren: node.children.length > 0,
    },
    ...flattenCategories(node.children, depth + 1, node.id, node.name),
  ]);
}

function nullable(value: string): string | null {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
