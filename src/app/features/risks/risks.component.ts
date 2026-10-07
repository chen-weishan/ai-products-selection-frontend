import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { EMPTY, Subscription, timer, exhaustMap, finalize, switchMap, take } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { DialogService } from '../../services/dialog-service';
import { ProductReferenceControllerService } from '../../api';
import { RiskService } from './risk.service';
import {
  RiskAlertItem,
  RiskSummary,
  RiskFilterState,
  RiskRuleItem,
  RecalculationStatus,
  RISK_TYPE_META,
  RiskTypeCode,
} from './risk.model';

/** 繁體中文語系設定 - Material 分頁器 */
export function getZhPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = '每頁筆數：';
  intl.nextPageLabel = '下一頁';
  intl.previousPageLabel = '上一頁';
  intl.firstPageLabel = '第一頁';
  intl.lastPageLabel = '最後一頁';
  intl.getRangeLabel = (page: number, pageSize: number, length: number) => {
    if (length === 0 || pageSize === 0) {
      return `0 / 共 ${length} 筆`;
    }
    const startIndex = page * pageSize;
    const endIndex =
      startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;
    return `${startIndex + 1} – ${endIndex} / 共 ${length} 筆`;
  };
  return intl;
}

@Component({
  selector: 'app-risks',
  standalone: true,
  imports: [
    A11yModule,
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: getZhPaginatorIntl }],
  templateUrl: './risks.component.html',
  styleUrl: './risks.component.scss',
})
export class RisksComponent implements OnInit, OnDestroy {
  private readonly riskService = inject(RiskService);
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly referenceService = inject(ProductReferenceControllerService);

  /** 10 種風險類型對照字典 */
  readonly riskTypeMeta = RISK_TYPE_META;
  readonly riskTypeKeys = Object.keys(RISK_TYPE_META) as RiskTypeCode[];

  /** 使用者角色權限 */
  readonly currentUser = this.authService.currentUser;
  readonly canManageRisks = computed(() =>
    this.authService.hasRole(['BUYER', 'BUYER_LEAD', 'SYS_ADMIN']),
  );
  readonly isSysAdmin = computed(() => this.authService.hasRole('SYS_ADMIN'));

  /** 狀態 Signals */
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  listError = signal<string | null>(null);
  summaryError = signal<string | null>(null);
  isLoadingSummary = signal(false);
  summaryAvailable = signal(false);
  pendingAlertIds = signal<Set<number>>(new Set());

  /** 頂部 KPI 統計摘要 */
  summary = signal<RiskSummary>({
    highRiskCount: 0,
    mediumRiskCount: 0,
    lowRiskCount: 0,
    monthlyHandledCount: 0,
    lastDetectedAt: null,
  });

  /** 示警表格資料與分頁 */
  alerts = signal<RiskAlertItem[]>([]);
  totalElements = signal<number>(0);
  pageIndex = signal<number>(0);
  pageSize = signal<number>(10);
  readonly pageSizeOptions: number[] = [5, 10, 20, 50];

  /** 篩選條件 Signals */
  searchKeyword = signal<string>('');
  filterStatus = signal<'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'IGNORED'>('ALL');
  filterSeverity = signal<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  filterRiskType = signal<'ALL' | string>('ALL');
  filterCategoryId = signal<'ALL' | number>('ALL');

  /** 品類選項清單 */
  categoryOptions = signal<{ id: number; name: string }[]>([]);
  categoryError = signal<string | null>(null);

  /** 忽略示警對話框狀態 */
  isIgnoreModalOpen = signal<boolean>(false);
  targetAlert = signal<RiskAlertItem | null>(null);
  ignoreReasonText = signal<string>('');
  ignoreError = signal<string | null>(null);
  isSubmittingIgnore = signal<boolean>(false);

  /** 規則門檻抽屜與重算進度狀態 */
  isRulesDrawerOpen = signal<boolean>(false);
  isLoadingRules = signal<boolean>(false);
  rulesList = signal<RiskRuleItem[]>([]);
  rulesError = signal<string | null>(null);
  recalculationWarning = signal<string | null>(null);
  rulesAvailable = signal(false);
  thresholdDrafts = signal<Record<string, string>>({});
  ruleSaveErrors = signal<Record<string, string>>({});
  savingRuleCode = signal<string | null>(null);
  recalculation = signal<RecalculationStatus>({
    running: false,
    progressPercent: 0,
    startedAt: null,
    updatedAt: null,
  });
  private recalcPollingSub?: Subscription;
  private listSub?: Subscription;
  private summarySub?: Subscription;
  private categorySub?: Subscription;
  private rulesSub?: Subscription;
  private searchSub?: Subscription;
  private readonly lifetime = new Subscription();
  private notificationTimer?: ReturnType<typeof setTimeout>;

  /** 表格欄位清單 */
  readonly displayedColumns: string[] = [
    'product',
    'riskType',
    'severity',
    'triggerValue',
    'impact',
    'detectedAt',
    'status',
    'handledInfo',
    'actions',
  ];

  ngOnInit(): void {
    this.loadCategories();
    this.loadSummary();
    this.loadAlerts();
  }

  ngOnDestroy(): void {
    this.stopRecalcPolling();
    this.listSub?.unsubscribe();
    this.summarySub?.unsubscribe();
    this.categorySub?.unsubscribe();
    this.rulesSub?.unsubscribe();
    this.searchSub?.unsubscribe();
    this.lifetime.unsubscribe();
    clearTimeout(this.notificationTimer);
  }

  @HostListener('document:keydown.escape')
  closeOverlay(): void {
    if (this.isIgnoreModalOpen()) this.closeIgnoreDialog();
    else if (this.isRulesDrawerOpen()) this.closeRulesDrawer();
  }

  /** 載入品類清單 */
  loadCategories(): void {
    this.categorySub?.unsubscribe();
    this.categoryError.set(null);
    this.categorySub = this.referenceService.getCategories().subscribe({
      next: (res: any) => {
        const list = res?.data || res;
        if (Array.isArray(list)) {
          this.categoryOptions.set(
            list.map((c: any) => ({
              id: c.id,
              name: c.name || c.categoryName,
            })),
          );
        }
      },
      error: () => {
        this.categoryOptions.set([]);
        this.categoryError.set('品類選項載入失敗，請重試。');
      },
    });
  }

  /** 載入頂部 KPI 摘要 */
  loadSummary(): void {
    this.summarySub?.unsubscribe();
    this.isLoadingSummary.set(true);
    this.summaryAvailable.set(false);
    this.summaryError.set(null);
    this.summarySub = this.riskService.getRiskSummary().subscribe({
      next: (res) => {
        this.summary.set(res);
        this.summaryAvailable.set(true);
        this.isLoadingSummary.set(false);
      },
      error: (err) => {
        this.isLoadingSummary.set(false);
        this.summaryError.set(this.errorText(err, '示警統計載入失敗，請重試。', '示警統計'));
      },
    });
  }

  /** 載入示警清單 */
  loadAlerts(): void {
    this.searchSub?.unsubscribe();
    this.listSub?.unsubscribe();
    this.isLoading.set(true);
    this.listError.set(null);
    this.alerts.set([]);
    this.totalElements.set(0);

    const filterState: RiskFilterState = {
      status: this.filterStatus(),
      severity: this.filterSeverity(),
      riskType: this.filterRiskType(),
      categoryId: this.filterCategoryId(),
      keyword: this.searchKeyword(),
    };

    this.listSub = this.riskService
      .getRisks(filterState, this.pageIndex(), this.pageSize())
      .subscribe({
        next: (res) => {
          this.alerts.set(res.content);
          this.totalElements.set(res.totalElements);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.listError.set(this.errorText(err, '載入風險示警清單失敗，請稍後重試。', '風險示警'));
        },
      });
  }

  /** 重新整理 */
  reload(): void {
    this.errorMessage.set(null);
    this.loadSummary();
    this.loadAlerts();
    if (this.categoryError()) this.loadCategories();
  }

  onSearchChange(keyword: string): void {
    this.searchKeyword.set(keyword.slice(0, 100));
    this.pageIndex.set(0);
    this.searchSub?.unsubscribe();
    this.listSub?.unsubscribe();
    this.alerts.set([]);
    this.totalElements.set(0);
    this.listError.set(null);
    this.isLoading.set(true);
    this.searchSub = timer(300).subscribe(() => this.loadAlerts());
  }

  /** 篩選條件變更觸發 */
  onFilterChange(): void {
    this.pageIndex.set(0);
    this.loadAlerts();
  }

  /** 分頁變更 */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadAlerts();
  }

  /** 重設所有篩選條件 */
  resetFilters(): void {
    this.searchKeyword.set('');
    this.filterStatus.set('ALL');
    this.filterSeverity.set('ALL');
    this.filterRiskType.set('ALL');
    this.filterCategoryId.set('ALL');
    this.pageIndex.set(0);
    this.loadAlerts();
  }

  /** 判斷是否為預設篩選 */
  isDefaultFilter(): boolean {
    return (
      !this.searchKeyword().trim() &&
      this.filterStatus() === 'ALL' &&
      this.filterSeverity() === 'ALL' &&
      this.filterRiskType() === 'ALL' &&
      this.filterCategoryId() === 'ALL'
    );
  }

  /** 確認處理示警 (Acknowledge) */
  acknowledgeAlert(alert: RiskAlertItem): void {
    if (!this.canManageRisks() || alert.status !== 'OPEN' || this.isAlertPending(alert.id)) return;
    this.setAlertPending(alert.id, true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.lifetime.add(
      this.dialogService
        .Confirm({
          title: '確認處理風險示警',
          message: `確定要將商品「${alert.productName}」的 ${this.getRiskLabel(alert.riskType)} 標記為「已處理」嗎？`,
          confirmText: '確定處理',
          cancelText: '取消',
        })
        .pipe(
          take(1),
          switchMap((confirmed) =>
            confirmed && this.canManageRisks() ? this.riskService.acknowledgeRisk(alert.id) : EMPTY,
          ),
          finalize(() => this.setAlertPending(alert.id, false)),
        )
        .subscribe({
          next: () => {
            this.showSuccessNotification(`已成功確認處理示警 #${alert.id}`);
            this.loadSummary();
            this.loadAlerts();
          },
          error: (err) => {
            if (err?.status === 409) {
              this.errorMessage.set('該示警已被其他人處理或狀態已變更，無法重複確認。');
            } else {
              this.errorMessage.set(this.errorText(err, '確認處理失敗，請稍後重試。', '示警處理'));
            }
          },
        }),
    );
  }

  /** 開啟忽略示警對話框 */
  openIgnoreDialog(alert: RiskAlertItem): void {
    if (
      !this.canManageRisks() ||
      alert.status !== 'OPEN' ||
      this.isAlertPending(alert.id) ||
      this.isIgnoreModalOpen()
    )
      return;
    this.targetAlert.set(alert);
    this.ignoreReasonText.set('');
    this.ignoreError.set(null);
    this.isIgnoreModalOpen.set(true);
  }

  /** 關閉忽略示警對話框 */
  closeIgnoreDialog(): void {
    if (this.isSubmittingIgnore()) return;
    this.isIgnoreModalOpen.set(false);
    this.targetAlert.set(null);
    this.ignoreReasonText.set('');
    this.ignoreError.set(null);
    this.isSubmittingIgnore.set(false);
  }

  /** 提交忽略示警 */
  submitIgnore(): void {
    const alert = this.targetAlert();
    if (
      !alert ||
      !this.canManageRisks() ||
      this.isSubmittingIgnore() ||
      this.isAlertPending(alert.id)
    )
      return;

    const reason = this.ignoreReasonText().trim();
    if (!reason) {
      this.ignoreError.set('請填寫忽略理由（必填項目）');
      return;
    }
    if (reason.length > 300) {
      this.ignoreError.set('忽略理由長度不可超過 300 字');
      return;
    }

    this.isSubmittingIgnore.set(true);
    this.setAlertPending(alert.id, true);
    this.ignoreError.set(null);
    this.successMessage.set(null);

    this.lifetime.add(
      this.riskService
        .ignoreRisk(alert.id, reason)
        .pipe(
          finalize(() => {
            this.isSubmittingIgnore.set(false);
            this.setAlertPending(alert.id, false);
          }),
        )
        .subscribe({
          next: () => {
            this.isSubmittingIgnore.set(false);
            this.closeIgnoreDialog();
            this.showSuccessNotification(`已將示警 #${alert.id} 標記為忽略。`);
            this.loadSummary();
            this.loadAlerts();
          },
          error: (err) => {
            this.isSubmittingIgnore.set(false);
            if (err?.status === 409) {
              this.ignoreError.set('該示警狀態已被變更，無法重複忽略。');
            } else {
              this.ignoreError.set(this.errorText(err, '忽略失敗，請稍後重試。', '示警處理'));
            }
          },
        }),
    );
  }

  isAlertPending(id: number): boolean {
    return this.pendingAlertIds().has(id);
  }

  private setAlertPending(id: number, pending: boolean): void {
    this.pendingAlertIds.update((ids) => {
      const next = new Set(ids);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** 開啟風險規則與門檻抽屜 */
  openRulesDrawer(): void {
    if (this.isRulesDrawerOpen()) return;
    this.isRulesDrawerOpen.set(true);
    this.loadRules();
  }

  /** 關閉風險規則抽屜 */
  closeRulesDrawer(): void {
    if (this.savingRuleCode()) return;
    this.isRulesDrawerOpen.set(false);
    this.awaitingRecalculation = false;
    this.stopRecalcPolling();
    this.rulesSub?.unsubscribe();
    this.isLoadingRules.set(false);
  }

  private awaitingRecalculation = false;
  private previousRecalculationStart: string | null = null;
  private recalculationWaitAttempts = 0;

  /** 載入規則與重算進度 */
  loadRules(): void {
    this.stopRecalcPolling();
    this.rulesSub?.unsubscribe();
    this.isLoadingRules.set(true);
    this.rulesAvailable.set(false);
    this.rulesError.set(null);
    this.recalculationWarning.set(null);
    this.rulesSub = this.riskService.getRiskRules().subscribe({
      next: (res) => {
        const previousRules = this.rulesList();
        const drafts = this.thresholdDrafts();
        this.thresholdDrafts.set(
          Object.fromEntries(
            res.rules.map((rule) => [
              this.ruleKey(rule),
              previousRules.some(
                (previous) =>
                  this.ruleKey(previous) === this.ruleKey(rule) &&
                  drafts[this.ruleKey(rule)] !== this.formatThresholdJson(previous.thresholdJson),
              )
                ? drafts[this.ruleKey(rule)]
                : this.formatThresholdJson(rule.thresholdJson),
            ]),
          ),
        );
        this.rulesList.set(res.rules);
        this.ruleSaveErrors.set({});
        this.recalculation.set(res.recalculation);
        this.rulesAvailable.set(true);
        if (res.recalculation.lastError || res.recalculation.errorMessage) {
          this.recalculationWarning.set(
            '前次背景重算失敗。可重新查詢進度，或修改門檻並儲存以觸發新一輪重算。',
          );
        }
        this.isLoadingRules.set(false);

        if (res.recalculation?.running || this.awaitingRecalculation) {
          this.startRecalcPolling();
        } else {
          this.stopRecalcPolling();
        }
      },
      error: (err) => {
        this.isLoadingRules.set(false);
        this.rulesAvailable.set(false);
        this.rulesError.set(this.errorText(err, '規則設定載入失敗，請重試。', '規則設定'));
      },
    });
  }

  /** 啟動重算進度輪詢 */
  private startRecalcPolling(): void {
    if (this.recalcPollingSub) return;
    this.recalcPollingSub = timer(2000, 2000)
      .pipe(exhaustMap(() => this.riskService.getRiskRules()))
      .subscribe({
        next: (res) => {
          this.recalculation.set(res.recalculation);
          if (!res.recalculation.lastError && !res.recalculation.errorMessage)
            this.recalculationWarning.set(null);
          if (this.awaitingRecalculation) {
            if (
              res.recalculation.running ||
              (res.recalculation.startedAt &&
                res.recalculation.startedAt !== this.previousRecalculationStart)
            ) {
              this.awaitingRecalculation = false;
            } else if (++this.recalculationWaitAttempts < 15) {
              return;
            } else {
              this.awaitingRecalculation = false;
              this.stopRecalcPolling();
              this.recalculationWarning.set(
                '門檻已儲存，但尚無法確認新一輪重算是否開始。請重新查詢進度。',
              );
              return;
            }
          }
          if (!res.recalculation?.running) {
            this.stopRecalcPolling();
            if (
              res.recalculation.status === 'FAILED' ||
              res.recalculation.lastError ||
              res.recalculation.errorMessage
            ) {
              this.recalculationWarning.set(
                '背景重算失敗。可重新查詢進度，或修改門檻並儲存以觸發新一輪重算。',
              );
            } else if (res.recalculation.progressPercent >= 100) {
              this.showSuccessNotification('背景全量扣分重算已完成！');
            } else {
              this.recalculationWarning.set('重算已停止，目前無法確認完成。請重新查詢進度。');
            }
            this.loadSummary();
            this.loadAlerts();
          }
        },
        error: (err) => {
          this.rulesAvailable.set(false);
          this.rulesError.set(
            this.errorText(err, '重算進度查詢失敗，尚無法確認完成。請重試。', '重算進度'),
          );
          this.stopRecalcPolling();
        },
      });
  }

  /** 停止重算進度輪詢 */
  private stopRecalcPolling(): void {
    if (this.recalcPollingSub) {
      this.recalcPollingSub.unsubscribe();
      this.recalcPollingSub = undefined;
    }
  }

  /** 儲存規則門檻 (僅 SYS_ADMIN) */
  saveRuleThreshold(rule: RiskRuleItem): void {
    if (!this.canSaveRule(rule)) return;
    const thresholdJson = JSON.parse(this.thresholdDrafts()[this.ruleKey(rule)]) as Record<
      string,
      unknown
    >;
    this.savingRuleCode.set(this.ruleKey(rule));
    this.ruleSaveErrors.update((errors) => ({ ...errors, [this.ruleKey(rule)]: '' }));
    this.successMessage.set(null);
    this.lifetime.add(
      this.riskService
        .updateRuleThreshold(rule.ruleCode, thresholdJson, rule.categoryId, rule.maxPenalty)
        .pipe(finalize(() => this.savingRuleCode.set(null)))
        .subscribe({
          next: (res) => {
            this.rulesList.update((rules) =>
              rules.map((item) =>
                this.ruleKey(item) === this.ruleKey(rule) ? { ...item, thresholdJson } : item,
              ),
            );
            this.thresholdDrafts.update((drafts) => ({
              ...drafts,
              [this.ruleKey(rule)]: this.formatThresholdJson(thresholdJson),
            }));
            this.showSuccessNotification(
              `規則【${this.getRiskLabel(rule.ruleCode)}】門檻已儲存。` +
                (res?.recalculationStarted ? '已接受背景重算，正在查詢進度。' : ''),
            );
            this.previousRecalculationStart = this.recalculation().startedAt ?? null;
            this.awaitingRecalculation = true;
            this.recalculationWaitAttempts = 0;
            this.loadRules();
          },
          error: (err) => {
            if (err?.status === 404 || err?.status === 501) {
              this.rulesAvailable.set(false);
              this.rulesError.set('規則儲存服務尚未提供，已停用儲存。請稍後重試。');
            }
            this.ruleSaveErrors.update((errors) => ({
              ...errors,
              [this.ruleKey(rule)]: this.errorText(
                err,
                '更新門檻失敗，修改內容已保留，請重試。',
                '規則儲存',
              ),
            }));
          },
        }),
    );
  }

  updateThresholdDraft(rule: RiskRuleItem, value: string): void {
    this.thresholdDrafts.update((drafts) => ({ ...drafts, [this.ruleKey(rule)]: value }));
    this.ruleSaveErrors.update((errors) => ({ ...errors, [this.ruleKey(rule)]: '' }));
  }

  readonly thresholdLabels: Record<string, string> = {
    negativeRateThreshold: '負評率門檻（%）',
    minSampleSize: '最低評論樣本數',
    slope7dThreshold: '七日熱度跌幅門檻（%）',
    slopePercentile: '熱度斜率百分位（%）',
    confidenceThreshold: '信心度門檻',
    climateFitPercentileThreshold: '氣候適配百分位門檻',
    daysBeforeLeadTimeCutoff: '節慶窗口提前提醒天數',
    penaltySubtotalThreshold: '扣分壓級門檻（固定）',
    moqThreshold: '最低訂購量門檻',
    shelfLifeDaysThreshold: '保存期限門檻（天）',
    highMoqPoints: '訂購量過高扣分',
    seasonalPoints: '季節性商品扣分',
    shortShelfLifePoints: '短保存期限扣分',
    fragilePoints: '易碎商品扣分',
    coldChainPoints: '冷鏈需求扣分',
    oversizedPoints: '超材商品扣分',
    meltableSummerPoints: '夏季易融商品扣分',
    conditions: '適用物流條件',
  };
  private readonly percentageFields = [
    'negativeRateThreshold',
    'slope7dThreshold',
    'slopePercentile',
  ];

  thresholdFields(rule: RiskRuleItem): string[] {
    return Object.keys(rule.thresholdJson);
  }
  thresholdLabel(key: string): string {
    return this.thresholdLabels[key] ?? '其他設定（' + key + '）';
  }
  thresholdValue(rule: RiskRuleItem, key: string): unknown {
    const draft = JSON.parse(
      this.thresholdDrafts()[this.ruleKey(rule)] ?? JSON.stringify(rule.thresholdJson),
    );
    const value = draft[key];
    return this.percentageFields.includes(key) && typeof value === 'number'
      ? Number((value * 100).toFixed(8))
      : value;
  }
  canEditThresholdField(rule: RiskRuleItem, key: string): boolean {
    return (
      this.isSysAdmin() &&
      rule.ruleCode !== 'PENALTY_CAP' &&
      !!this.thresholdLabels[key] &&
      typeof rule.thresholdJson[key] === 'number'
    );
  }
  thresholdDisplay(rule: RiskRuleItem, key: string): string {
    const value = this.thresholdValue(rule, key);
    const conditions: Record<string, string> = {
      CHILLED: '冷藏',
      FROZEN: '冷凍',
      FRAGILE: '易碎',
      MELTABLE: '易融',
      OVERSIZED: '超材',
    };
    return Array.isArray(value)
      ? value.map((item) => conditions[String(item)] ?? String(item)).join('、')
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  }
  updateThresholdField(rule: RiskRuleItem, key: string, value: number | null): void {
    if (
      !this.canEditThresholdField(rule, key) ||
      !this.rulesAvailable() ||
      this.rulesError() ||
      this.savingRuleCode() ||
      this.recalculation().running
    )
      return;
    const draft = JSON.parse(
      this.thresholdDrafts()[this.ruleKey(rule)] ?? JSON.stringify(rule.thresholdJson),
    );
    draft[key] = value == null ? null : this.percentageFields.includes(key) ? value / 100 : value;
    this.updateThresholdDraft(rule, JSON.stringify(draft, null, 2));
  }

  resetRuleDraft(rule: RiskRuleItem): void {
    this.updateThresholdDraft(rule, this.formatThresholdJson(rule.thresholdJson));
  }

  getThresholdError(rule: RiskRuleItem): string | null {
    try {
      const draft = JSON.parse(this.thresholdDrafts()[this.ruleKey(rule)] ?? '');
      if (!draft || typeof draft !== 'object' || Array.isArray(draft))
        return '門檻必須是 JSON 物件。';
      const originalKeys = Object.keys(rule.thresholdJson).sort();
      if (JSON.stringify(Object.keys(draft).sort()) !== JSON.stringify(originalKeys)) {
        return '請保留既有門檻欄位，只調整設定值。';
      }
      for (const key of originalKeys) {
        if (!this.sameThresholdShape(draft[key], rule.thresholdJson[key])) {
          return `欄位 ${this.thresholdLabel(key)} 的資料類型或數值不正確。`;
        }
        if (
          ['negativeRateThreshold', 'slopePercentile'].includes(key) &&
          (draft[key] < 0 || draft[key] > 1)
        )
          return `欄位 ${this.thresholdLabel(key)} 必須介於 0 與 1。`;
        if (
          ['confidenceThreshold', 'climateFitPercentileThreshold'].includes(key) &&
          (draft[key] < 0 || draft[key] > 100)
        )
          return `欄位 ${this.thresholdLabel(key)} 必須介於 0 與 100。`;
      }
      const bounds: Record<string, [number, number, boolean?]> = {
        minSampleSize: [1, 100000, true],
        confidenceThreshold: [0, 100, true],
        daysBeforeLeadTimeCutoff: [1, 30, true],
        shelfLifeDaysThreshold: [0, 3650, true],
        moqThreshold: [0, 1000000, true],
        meltableSummerPoints: [0, 10],
        coldChainPoints: [0, 10],
        fragilePoints: [0, 10],
        oversizedPoints: [0, 10],
        shortShelfLifePoints: [0, 10],
        seasonalPoints: [0, 10],
        highMoqPoints: [0, 10],
      };
      for (const [key, [min, max, integer]] of Object.entries(bounds)) {
        if (
          key in draft &&
          (draft[key] < min || draft[key] > max || (integer && !Number.isInteger(draft[key])))
        )
          return `欄位 ${this.thresholdLabel(key)} 超出允許範圍或必須為整數。`;
      }
      if (
        'slope7dThreshold' in draft &&
        (draft.slope7dThreshold < -1 || draft.slope7dThreshold >= 0)
      )
        return '熱度急墜門檻必須介於 -1（含）與 0（不含）。';
      if ('slopePercentile' in draft && draft.slopePercentile <= 0) return '斜率百分位必須大於 0。';
      if ('climateFitPercentileThreshold' in draft && draft.climateFitPercentileThreshold <= 0)
        return '氣候適配百分位必須大於 0。';
      return null;
    } catch {
      return 'JSON 格式不正確，請檢查逗號、引號與括號。';
    }
  }

  private sameThresholdShape(value: unknown, original: unknown): boolean {
    if (original === null) return value === null;
    if (typeof value !== typeof original) return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(original)) {
      return (
        Array.isArray(value) &&
        value.length === original.length &&
        value.every((item, index) => this.sameThresholdShape(item, original[index]))
      );
    }
    if (typeof original === 'object') {
      if (!value || Array.isArray(value)) return false;
      const previous = original as Record<string, unknown>;
      const current = value as Record<string, unknown>;
      return (
        JSON.stringify(Object.keys(previous).sort()) ===
          JSON.stringify(Object.keys(current).sort()) &&
        Object.keys(previous).every((key) => this.sameThresholdShape(current[key], previous[key]))
      );
    }
    return true;
  }

  isRuleChanged(rule: RiskRuleItem): boolean {
    if (this.getThresholdError(rule)) return false;
    const draft = JSON.parse(this.thresholdDrafts()[this.ruleKey(rule)]);
    return Object.keys(rule.thresholdJson).some(
      (key) => JSON.stringify(draft[key]) !== JSON.stringify(rule.thresholdJson[key]),
    );
  }

  ruleKey(rule: RiskRuleItem): string {
    return rule.categoryId == null ? rule.ruleCode : `${rule.ruleCode}:${rule.categoryId}`;
  }

  canSaveRule(rule: RiskRuleItem): boolean {
    return (
      rule.ruleCode !== 'PENALTY_CAP' &&
      this.isSysAdmin() &&
      this.rulesAvailable() &&
      !this.isLoadingRules() &&
      !this.rulesError() &&
      !this.savingRuleCode() &&
      !this.recalculation().running &&
      !this.getThresholdError(rule) &&
      this.isRuleChanged(rule)
    );
  }

  /** 格式化門檻 JSON 供編輯顯示 */
  formatThresholdJson(json: Record<string, unknown>): string {
    return JSON.stringify(json, null, 2);
  }

  /** 輔助：取得風險中文名稱 */
  getRiskLabel(type: string): string {
    return this.riskTypeMeta[type]?.label || type;
  }

  /** 輔助：取得嚴重度 CSS 類別 */
  getSeverityBadgeClass(severity: string): string {
    switch (severity) {
      case 'HIGH':
        return 'status-warn';
      case 'MEDIUM':
        return 'status-quota';
      case 'LOW':
      default:
        return 'override-badge';
    }
  }

  /** 輔助：取得嚴重度中文標籤 */
  getSeverityLabel(severity: string): string {
    switch (severity) {
      case 'HIGH':
        return '高風險';
      case 'MEDIUM':
        return '中風險';
      case 'LOW':
        return '低風險';
      default:
        return severity;
    }
  }

  /** 輔助：取得狀態 CSS 類別 */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'OPEN':
        return 'status-quota';
      case 'ACKNOWLEDGED':
        return 'status-normal';
      case 'IGNORED':
        return 'override-badge';
      default:
        return 'override-badge';
    }
  }

  /** 輔助：取得狀態中文標籤 */
  getStatusLabel(status: string): string {
    switch (status) {
      case 'OPEN':
        return '待處理';
      case 'ACKNOWLEDGED':
        return '已確認';
      case 'IGNORED':
        return '已忽略';
      default:
        return status;
    }
  }

  /** 顯示成功提示訊息 */
  private showSuccessNotification(msg: string): void {
    clearTimeout(this.notificationTimer);
    this.successMessage.set(msg);
    this.notificationTimer = setTimeout(() => {
      this.successMessage.set(null);
    }, 4000);
  }

  private errorText(
    err: { status?: number; message?: string },
    fallback: string,
    feature: string,
  ): string {
    if (err?.status === 404 || err?.status === 501) return `${feature}服務尚未提供，請稍後重試。`;
    if (err?.status === 401) return '登入已失效，請重新登入。';
    if (err?.status === 403) return '目前帳號沒有執行此操作的權限。';
    if (err?.status === 0) return '無法連線至服務，請確認連線後重試。';
    return err?.status == null && err?.message ? err.message : fallback;
  }
}
