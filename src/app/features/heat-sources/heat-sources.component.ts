import { Component, OnInit, inject, signal, computed, effect, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HeatSourceControllerService,
  HeatSourceDetailResponse,
  ExcludedHeatSourceResponse,
  HeatSourceTestResponse
} from '../../api';
import { AuthService } from '../../core/auth/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, Subscription, takeUntil } from 'rxjs';

/** 來源靜態顯示元資料 */
export interface SourceMeta {
  name: string;
  defaultType: string;
  defaultGranularity: string;
  description: string;
}

const SOURCE_META: Record<string, SourceMeta> = {
  THREADS: {
    name: 'Threads',
    defaultType: 'Apify 採集',
    defaultGranularity: '關鍵字級',
    description: '透過 Apify 排程採集 Threads 關鍵字聲量'
  },
  GOOGLE_TRENDS: {
    name: 'Google Trends',
    defaultType: 'Apify 採集',
    defaultGranularity: '關鍵字級',
    description: '透過 Apify 取得關鍵字搜尋熱度趨勢'
  },
  INSTAGRAM: {
    name: 'Instagram Hashtag',
    defaultType: 'Apify 採集',
    defaultGranularity: '品類級',
    description: '透過 Apify 採集 Hashtag 資料，監控品類級熱度'
  },
  MANUAL: {
    name: '人工熱度標記',
    defaultType: '內部資料庫',
    defaultGranularity: '關鍵字級',
    description: '採購人員手動標記社群趨勢，涵蓋無法合法程式化採集之平台'
  }
};

@Component({
  selector: 'app-heat-sources',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  providers: [DatePipe],
  templateUrl: './heat-sources.component.html',
  styleUrl: './heat-sources.component.scss'
})
export class HeatSourcesComponent implements OnInit {
  private heatSourceApi = inject(HeatSourceControllerService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private datePipe = inject(DatePipe);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);

  private readonly destroyRef = inject(DestroyRef);
  private readonly sessionChanged$ = new Subject<void>();
  private sourceSubscription?: Subscription;
  private excludedSubscription?: Subscription;
  private initialized = false;
  private loadedIdentity = '';
  readonly currentUser = this.authService.currentUser;
  readonly sourceError = signal('');
  readonly excludedError = signal('');
  readonly excludedLoading = signal(false);
  readonly lastLoadedAt = signal<string | null>(null);
  readonly recalculationNotice = signal('');
  readonly hasPendingOperation = computed(() => Object.values(this.testingSourceIds()).some(Boolean) || Object.values(this.updatingSourceIds()).some(Boolean));
  readonly unknownCount = computed(() => this.sources().filter(s => s.enabled && !['AVAILABLE', 'DEGRADED', 'UNAVAILABLE'].includes(s.availability || '')).length);
  readonly summaryMessage = computed(() => {
    if (this.loading()) return '正在取得來源狀態';
    if (this.sourceError()) return '來源狀態載入失敗，暫時無法判斷';
    if (!this.sources().length) return '目前沒有熱度來源資料';
    if (!this.activeCount()) return '全部來源已停止採集；既有讀值仍可能參與評分';
    if (this.unknownCount()) return '部分已啟用來源狀態未知，請重新整理或測試連線';
    if (this.unavailableCount() || this.degradedCount()) return '部分已啟用來源降級或不可用，請查看狀態原因';
    return '已啟用來源的最近回報狀態正常';
  });

  constructor() {
    effect(() => {
      const user = this.currentUser();
      const identity = JSON.stringify([user?.id, user?.role, user?.roles]);
      if (this.initialized && identity !== this.loadedIdentity) {
        this.loadedIdentity = identity;
        this.sessionChanged$.next();
        this.cancelEditWeight();
        this.testingSourceIds.set({});
        this.updatingSourceIds.set({});
        this.recalculationNotice.set('');
        this.loadAll();
      }
    });
  }

  displayedColumns: string[] = [
    'name',
    'type',
    'granularity',
    'weight',
    'quota',
    'lastFetched',
    'lastProbed',
    'status',
    'actions'
  ];

  // 狀態 Signals
  sources = signal<HeatSourceDetailResponse[]>([]);
  excludedSources = signal<ExcludedHeatSourceResponse[]>([]);
  loading = signal(false);
  testingSourceIds = signal<Record<number, boolean>>({});
  updatingSourceIds = signal<Record<number, boolean>>({});

  // 權重編輯狀態
  editingWeightId = signal<number | null>(null);
  editWeightInput = signal<number | null>(null);

  // 權限檢查
  isSysAdmin(): boolean {
    return this.authService.hasRole(['SYS_ADMIN']);
  }

  // 統計 Signals
  activeCount = computed(() => this.sources().filter(s => s.enabled).length);
  availableCount = computed(() => this.sources().filter(s => s.enabled && s.availability === 'AVAILABLE').length);
  degradedCount = computed(() => this.sources().filter(s => s.enabled && s.availability === 'DEGRADED').length);
  unavailableCount = computed(() => this.sources().filter(s => s.enabled && s.availability === 'UNAVAILABLE').length);

  degradedSources = computed(() => {
    return this.sources().filter(s => s.enabled && s.availability === 'DEGRADED' || s.availability === 'UNAVAILABLE');
  });

  // 降級動態重分配權重計算 (依 §5.3.2 規範)
  recalculatedWeights = computed(() => {
    const all = this.sources();
    // enabled 僅控制採集；既有讀值可繼續參與合成。此為設定試算，非 applied_weights。
    const eligibleSources = all.filter(s => ['AVAILABLE', 'DEGRADED'].includes(s.availability || '')
      && Number.isFinite(s.compositeWeight) && (s.compositeWeight ?? 0) > 0);
    const effectiveWeight = (s: HeatSourceDetailResponse) => (s.compositeWeight ?? 0) * (s.granularity === 'CATEGORY' ? 0.5 : 1);
    const totalEligibleWeight = eligibleSources.reduce((sum, s) => sum + effectiveWeight(s), 0);

    if (totalEligibleWeight <= 0) return [];

    return eligibleSources.map(s => {
      const originalW = s.compositeWeight ?? 0;
      const reWeight = (effectiveWeight(s) / totalEligibleWeight) * 100;
      let shortName = this.getSourceName(s.sourceCode);
      shortName = shortName.replace('官方 API', '').replace('Hashtag', '').trim();
      if (shortName === 'Google Trends') shortName = 'Trends';

      return {
        code: s.sourceCode,
        name: shortName,
        originalPct: Math.round(originalW * 1000) / 10,
        newPct: Math.round(reWeight * 10) / 10,
        enabled: s.enabled,
        categoryDiscount: s.granularity === 'CATEGORY'
      };
    });
  });

  ngOnInit(): void {
    const user = this.currentUser();
    this.loadedIdentity = JSON.stringify([user?.id, user?.role, user?.roles]);
    this.initialized = true;
    this.loadAll();
  }

  loadAll(): void {
    if (this.hasPendingOperation()) return;
    this.loadSources();
    this.loadExcludedSources();
  }

  loadSources(): void {
    if (this.hasPendingOperation()) return;
    this.sourceSubscription?.unsubscribe();
    this.sourceError.set('');
    this.sources.set([]);
    this.loading.set(true);
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    this.sourceSubscription = this.heatSourceApi.list5('body', false, jsonOptions)
      .pipe(takeUntil(this.sessionChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        const data = res?.data || res || [];
        this.sources.set(Array.isArray(data) ? data : []);
        this.lastLoadedAt.set(new Date().toISOString());
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading.set(false);
        this.sourceError.set(this.errorMessage(err));
        const msg = this.errorMessage(err);
        this.snackBar.open(`無法載入熱度來源: ${msg}`, '關閉', { duration: 3500 });
        this.cdr.markForCheck();
      }
    });
  }

  loadExcludedSources(): void {
    this.excludedSubscription?.unsubscribe();
    this.excludedError.set('');
    this.excludedSources.set([]);
    this.excludedLoading.set(true);
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };
    this.excludedSubscription = this.heatSourceApi.excluded('body', false, jsonOptions)
      .pipe(takeUntil(this.sessionChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        const data = res?.data || res || [];
        this.excludedLoading.set(false);
        this.excludedSources.set(Array.isArray(data) ? data : []);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.excludedLoading.set(false);
        this.excludedError.set(this.errorMessage(err));
      }
    });
  }

  // ── 格式化與輔助方法 ──

  getSourceName(code?: string): string {
    if (!code) return '未知來源';
    return SOURCE_META[code]?.name || code;
  }

  getSourceType(row: HeatSourceDetailResponse): string {
    if (row.sourceCode === 'MANUAL') return '內部資料庫';
    if (['THREADS', 'GOOGLE_TRENDS', 'INSTAGRAM'].includes(row.sourceCode || '')) return 'Apify 採集';
    return row.adapterType || '-';
  }

  getSourceGranularity(row: HeatSourceDetailResponse): string {
    if (row.granularity === 'KEYWORD') return '關鍵字級';
    if (row.granularity === 'CATEGORY') return '品類級';
    return row.granularity || (row.sourceCode ? SOURCE_META[row.sourceCode]?.defaultGranularity : '-') || '-';
  }

  /** 外部來源為 Apify 帳號用量快照，單位美分；缺少上限不代表無上限。 */
  formatQuota(row: HeatSourceDetailResponse): string {
    if (row.sourceCode === 'MANUAL') return '不適用（內部標記）';
    if (row.quotaUsed == null || !Number.isFinite(row.quotaUsed) || row.quotaUsed < 0) return '用量未提供';
    const used = `$${(row.quotaUsed / 100).toFixed(2)}`;
    if (row.quotaLimit == null || row.quotaLimit <= 0 || !Number.isFinite(row.quotaLimit)) return `${used} / 上限未提供`;
    return `${used} / $${(row.quotaLimit / 100).toFixed(2)} (${Math.round(row.quotaUsed / row.quotaLimit * 100)}%)`;
  }

  private errorMessage(err: any): string {
    return err?.error?.error?.message || err?.error?.message || (err?.status === 0 ? '無法連線至伺服器' : err?.message) || '請稍後重試';
  }

  formatLastFetched(dateStr?: string | null): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return this.datePipe.transform(date, 'yyyy/MM/dd HH:mm', '+0800') || dateStr;
    } catch {
      return dateStr;
    }
  }

  formatLastProbed(dateStr?: string | null): string {
    if (!dateStr) return '尚未探測';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return this.datePipe.transform(date, 'MM/dd HH:mm', '+0800') || dateStr;
    } catch {
      return dateStr;
    }
  }

  getStatusBadge(availability?: string): { label: string; cssClass: string; icon: string } {
    switch (availability) {
      case 'AVAILABLE':
        return { label: '正常', cssClass: 'status-normal', icon: 'check_circle' };
      case 'DEGRADED':
        return { label: '降級', cssClass: 'status-warn', icon: 'warning' };
      case 'UNAVAILABLE':
        return { label: '不可用', cssClass: 'status-danger', icon: 'error' };
      default:
        return { label: availability || '未知', cssClass: 'status-unknown', icon: 'help' };
    }
  }

  /** 狀態燈號的診斷提示 */
  getStatusTooltip(row: HeatSourceDetailResponse): string {
    const tips: string[] = [];
    if (!row.enabled) {
      tips.push('來源已被停用採集，既有讀值仍可能參與評分');
    }
    if (row.consecutiveProbeFailures && row.consecutiveProbeFailures > 0) {
      tips.push(`連續探測失敗 ${row.consecutiveProbeFailures} 次`);
    }
    if (row.sourceCode !== 'MANUAL' && row.quotaLimit && row.quotaLimit > 0) {
      const quotaUsed = row.quotaUsed ?? 0;
      const ratio = quotaUsed / row.quotaLimit;
      if (ratio >= 1.0) {
        tips.push('額度已耗盡 (100%)');
      } else if (ratio >= 0.8) {
        tips.push(`額度高於 80% (${Math.round(ratio * 100)}%)`);
      }
    }
    const timestamp = row.lastFetchedAt ? new Date(row.lastFetchedAt).getTime() : NaN;
    if (Number.isFinite(timestamp)) {
      const taipeiDay = (ms: number) => Math.floor((ms + 8 * 60 * 60 * 1000) / (24 * 60 * 60 * 1000));
      const age = taipeiDay(Date.now()) - taipeiDay(timestamp);
      if (age > 2) tips.push(`最後採集已落後 ${age} 天，資料可能過期`);
    } else {
      tips.push('尚無有效採集時間，無法確認資料新鮮度');
    }
    if (!['AVAILABLE', 'DEGRADED', 'UNAVAILABLE'].includes(row.availability || '')) tips.push('來源狀態未知');
    if (tips.length === 0 && row.availability !== 'AVAILABLE') tips.push('最近回報狀態異常，API 未提供完整原因');
    if (tips.length === 0) {
      return '最近回報狀態正常；重新整理只讀取已保存的狀態';
    }
    return tips.join('；');
  }

  isQuotaHigh(row: HeatSourceDetailResponse): boolean {
    if (row.sourceCode === 'MANUAL' || !row.quotaLimit || row.quotaLimit <= 0) return false;
    return ((row.quotaUsed ?? 0) / row.quotaLimit) >= 0.8;
  }

  // ── 權限與操作 ──

  /** 測試連線 (僅限 SYS_ADMIN) */
  testConnection(row: HeatSourceDetailResponse): void {
    if (!this.isSysAdmin()) {
      this.snackBar.open('權限不足：僅系統管理員 (SYS_ADMIN) 可執行連線測試', '關閉', { duration: 3000 });
      return;
    }
    if (!row.id || this.loading() || this.hasPendingOperation()) return;

    this.testingSourceIds.update(map => ({ ...map, [row.id!]: true }));
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    this.heatSourceApi.test({ id: row.id }, 'body', false, jsonOptions)
      .pipe(takeUntil(this.sessionChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        this.testingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        const testRes: HeatSourceTestResponse = res?.data || res;
        const msg = testRes?.message || (testRes?.success ? '探測成功' : '探測失敗');
        this.snackBar.open(`[${this.getSourceName(row.sourceCode)}] ${msg}`, '關閉', { duration: 3500 });
        this.loadSources();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.testingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        console.error('[HeatSources] 連線測試失敗:', err);
        const msg = this.errorMessage(err);
        this.snackBar.open(`[${this.getSourceName(row.sourceCode)}] 連線測試失敗: ${msg}`, '關閉', { duration: 4000 });
        this.cdr.markForCheck();
      }
    });
  }

  /** 啟用 / 停用切換 (僅限 SYS_ADMIN) */
  toggleEnabled(row: HeatSourceDetailResponse): void {
    if (!this.isSysAdmin()) {
      this.snackBar.open('權限不足：僅系統管理員 (SYS_ADMIN) 可切換來源啟用狀態', '關閉', { duration: 3000 });
      return;
    }
    if (!row.id || this.loading() || this.hasPendingOperation()) return;

    const newEnabled = !row.enabled;
    const actionText = newEnabled ? '啟用' : '停用';
    if (!confirm(`確定要${actionText}「${this.getSourceName(row.sourceCode)}」的採集嗎？停用採集後，既有讀值仍可能參與評分。`)) {
      return;
    }

    this.updatingSourceIds.update(map => ({ ...map, [row.id!]: true }));
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    this.heatSourceApi.update2(
      { id: row.id, heatSourceUpdateRequest: { enabled: newEnabled } },
      'body',
      false,
      jsonOptions
    ).pipe(takeUntil(this.sessionChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        this.cancelEditWeight();
        this.snackBar.open(`已${actionText}「${this.getSourceName(row.sourceCode)}」的採集`, '關閉', { duration: 2500 });
        this.loadSources();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        console.error('[HeatSources] 切換啟用狀態失敗:', err);
        const msg = this.errorMessage(err);
        this.snackBar.open(`${actionText}失敗: ${msg}`, '關閉', { duration: 3500 });
        this.cdr.markForCheck();
      }
    });
  }

  /** 開始編輯權重 (僅限 SYS_ADMIN) */
  startEditWeight(row: HeatSourceDetailResponse): void {
    if (!this.isSysAdmin()) {
      this.snackBar.open('權限不足：僅系統管理員 (SYS_ADMIN) 可調整合成權重', '關閉', { duration: 3000 });
      return;
    }
    if (!row.id || this.loading() || this.hasPendingOperation()) return;
    this.editingWeightId.set(row.id);
    // 預設將 0~1 的 weight 轉成百分比 (例如 0.4 -> 40)
    const currentWeight = row.compositeWeight ?? 0;
    this.editWeightInput.set(Math.round(currentWeight * 1000) / 10);
  }

  cancelEditWeight(): void {
    this.editingWeightId.set(null);
    this.editWeightInput.set(null);
  }

  /**
   * 儲存權重 (附帶 Dirty Check 與 0–1 最多 3 位小數檢核)
   */
  saveWeight(row: HeatSourceDetailResponse): void {
    if (!this.isSysAdmin()) {
      this.snackBar.open('權限不足：僅系統管理員 (SYS_ADMIN) 可調整合成權重', '關閉', { duration: 3000 });
      return;
    }
    if (!row.id || this.loading() || this.hasPendingOperation()) return;

    if (this.editingWeightId() !== row.id) return;
    const inputVal = this.editWeightInput();
    if (inputVal === null || inputVal === undefined || !Number.isFinite(inputVal)) {
      this.snackBar.open('請輸入合法的權重數值 (0% ~ 100%)', '關閉', { duration: 3000 });
      return;
    }

    if (inputVal < 0 || inputVal > 100) {
      this.snackBar.open('權重百分比必須介於 0% 到 100% 之間', '關閉', { duration: 3000 });
      return;
    }

    // 換算為 0~1 的 BigDecimal 浮點數，最多 3 位小數
    const newWeight = Math.round((inputVal / 100) * 1000) / 1000;
    const currentWeight = row.compositeWeight !== undefined && row.compositeWeight !== null
      ? Math.round(row.compositeWeight * 1000) / 1000
      : 0;

    // ── Dirty Check ──
    // 若數值未變更，略過 PUT 請求避免後端觸發不必要的全量重算
    if (newWeight === currentWeight) {
      this.snackBar.open('權重數值未變更，已取消更新', '關閉', { duration: 2000 });
      this.cancelEditWeight();
      return;
    }

    this.updatingSourceIds.update(map => ({ ...map, [row.id!]: true }));
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    this.heatSourceApi.update2(
      { id: row.id, heatSourceUpdateRequest: { compositeWeight: newWeight } },
      'body',
      false,
      jsonOptions
    ).pipe(takeUntil(this.sessionChanged$), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        this.snackBar.open(
          `「${this.getSourceName(row.sourceCode)}」權重已更新為 ${(newWeight * 100).toFixed(1)}%，系統將非同步重算品項評分`,
          '關閉',
          { duration: 4000 }
        );
        this.recalculationNotice.set('權重設定已保存，系統將非同步重算品項評分；目前 API 無法確認重算進度、是否完成或失敗。');
        if (this.editingWeightId() === row.id) this.cancelEditWeight();
        this.loadSources();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        console.error('[HeatSources] 更新權重失敗:', err);
        const msg = this.errorMessage(err);
        this.snackBar.open(`更新權重失敗: ${msg}`, '關閉', { duration: 4000 });
        this.cdr.markForCheck();
      }
    });
  }

  isRowBusy(_id?: number): boolean {
    return this.loading() || this.hasPendingOperation();
  }

  isRowTesting(id?: number): boolean {
    return !!id && !!this.testingSourceIds()[id];
  }

  isRowUpdating(id?: number): boolean {
    return !!id && !!this.updatingSourceIds()[id];
  }

  goBack(): void {
    this.location.back();
  }
}
