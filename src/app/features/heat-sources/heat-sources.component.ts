import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HeatSourceControllerService,
  HeatSourceDetailResponse,
  ExcludedHeatSourceResponse,
  HeatSourceTestResponse
} from '../../api';
import { AuthService } from '../../core/auth/auth.service';

/** 來源靜態顯示元資料 */
export interface SourceMeta {
  name: string;
  defaultType: string;
  defaultGranularity: string;
  description: string;
}

const SOURCE_META: Record<string, SourceMeta> = {
  THREADS: {
    name: 'Threads 官方 API',
    defaultType: 'REST 排程',
    defaultGranularity: '關鍵字級',
    description: 'Meta 官方 Threads API，排程採集關鍵字聲量'
  },
  GOOGLE_TRENDS: {
    name: 'Google Trends',
    defaultType: '非官方',
    defaultGranularity: '關鍵字級',
    description: '非官方 Trends 爬蟲，獲取關鍵字搜尋熱度趨勢'
  },
  INSTAGRAM: {
    name: 'Instagram Hashtag',
    defaultType: 'Graph API',
    defaultGranularity: '品類級',
    description: 'Meta Graph API Hashtag 搜尋，品類級熱度監控'
  },
  MANUAL: {
    name: '人工熱度標記',
    defaultType: '內部資料庫',
    defaultGranularity: '混合(依標記)',
    description: '採購人員手動標記社群趨勢，涵蓋無法合法程式化採集之平台'
  }
};

@Component({
  selector: 'app-heat-sources',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  availableCount = computed(() => this.sources().filter(s => s.availability === 'AVAILABLE').length);
  degradedCount = computed(() => this.sources().filter(s => s.availability === 'DEGRADED').length);
  unavailableCount = computed(() => this.sources().filter(s => s.availability === 'UNAVAILABLE').length);

  degradedSources = computed(() => {
    return this.sources().filter(s => s.availability === 'DEGRADED' || s.availability === 'UNAVAILABLE');
  });

  // 降級動態重分配權重計算 (依 §5.3.2 規範)
  recalculatedWeights = computed(() => {
    const all = this.sources();
    // 貢獻合成權重條件：已啟用且非 UNAVAILABLE
    const eligibleSources = all.filter(s => s.enabled && s.availability !== 'UNAVAILABLE');
    const totalEligibleWeight = eligibleSources.reduce((sum, s) => sum + (s.compositeWeight ?? 0), 0);

    if (totalEligibleWeight <= 0) return [];

    return eligibleSources.map(s => {
      const originalW = s.compositeWeight ?? 0;
      const reWeight = (originalW / totalEligibleWeight) * 100;
      let shortName = this.getSourceName(s.sourceCode);
      shortName = shortName.replace('官方 API', '').replace('Hashtag', '').trim();
      if (shortName === 'Google Trends') shortName = 'Trends';

      return {
        code: s.sourceCode,
        name: shortName,
        originalPct: Math.round(originalW * 1000) / 10,
        newPct: Math.round(reWeight * 10) / 10
      };
    });
  });

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loadSources();
    this.loadExcludedSources();
  }

  loadSources(): void {
    this.loading.set(true);
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    this.heatSourceApi.list4('body', false, jsonOptions).subscribe({
      next: (res: any) => {
        this.loading.set(false);
        const data = res?.data || res || [];
        this.sources.set(Array.isArray(data) ? data : []);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading.set(false);
        console.error('[HeatSources] 載入熱度來源失敗:', err);
        const msg = err?.error?.message || err?.message || '載入失敗';
        this.snackBar.open(`無法載入熱度來源: ${msg}`, '關閉', { duration: 3500 });
        this.cdr.markForCheck();
      }
    });
  }

  loadExcludedSources(): void {
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };
    this.heatSourceApi.excluded('body', false, jsonOptions).subscribe({
      next: (res: any) => {
        const data = res?.data || res || [];
        this.excludedSources.set(Array.isArray(data) ? data : []);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[HeatSources] 載入不採用來源失敗:', err);
      }
    });
  }

  // ── 格式化與輔助方法 ──

  getSourceName(code?: string): string {
    if (!code) return '未知來源';
    return SOURCE_META[code]?.name || code;
  }

  getSourceType(row: HeatSourceDetailResponse): string {
    return row.adapterType || (row.sourceCode ? SOURCE_META[row.sourceCode]?.defaultType : '-') || '-';
  }

  getSourceGranularity(row: HeatSourceDetailResponse): string {
    if (row.granularity === 'KEYWORD') return '關鍵字級';
    if (row.granularity === 'CATEGORY') return '品類級';
    return row.granularity || (row.sourceCode ? SOURCE_META[row.sourceCode]?.defaultGranularity : '-') || '-';
  }

  /**
   * 額度格式化：單位為美分 (Cents)。
   * quotaUsed: 350 -> $3.50
   * quotaLimit: null -> 無上限 (MANUAL 來源)
   */
  formatQuota(row: HeatSourceDetailResponse): string {
    const usedCents = row.quotaUsed ?? 0;
    const usedDollars = (usedCents / 100).toFixed(2);

    if (row.quotaLimit === null || row.quotaLimit === undefined) {
      return `$${usedDollars} / 無上限`;
    }

    const limitDollars = (row.quotaLimit / 100).toFixed(2);
    const ratio = row.quotaLimit > 0 ? Math.round((usedCents / row.quotaLimit) * 100) : 0;
    return `$${usedDollars} / $${limitDollars} (${ratio}%)`;
  }

  formatLastFetched(dateStr?: string | null): string {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return this.datePipe.transform(date, 'yyyy/MM/dd HH:mm') || dateStr;
    } catch {
      return dateStr;
    }
  }

  formatLastProbed(dateStr?: string | null): string {
    if (!dateStr) return '尚未探測';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return this.datePipe.transform(date, 'MM/dd HH:mm') || dateStr;
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
      tips.push('來源已被停用');
    }
    if (row.consecutiveProbeFailures && row.consecutiveProbeFailures > 0) {
      tips.push(`連續探測失敗 ${row.consecutiveProbeFailures} 次`);
    }
    if (row.quotaLimit && row.quotaLimit > 0) {
      const quotaUsed = row.quotaUsed ?? 0;
      const ratio = quotaUsed / row.quotaLimit;
      if (ratio >= 1.0) {
        tips.push('額度已耗盡 (100%)');
      } else if (ratio >= 0.8) {
        tips.push(`額度高於 80% (${Math.round(ratio * 100)}%)`);
      }
    }
    if (tips.length === 0) {
      return '服務正常，探測無異常';
    }
    return tips.join('；');
  }

  isQuotaHigh(row: HeatSourceDetailResponse): boolean {
    if (!row.quotaLimit || row.quotaLimit <= 0) return false;
    return ((row.quotaUsed ?? 0) / row.quotaLimit) >= 0.8;
  }

  // ── 權限與操作 ──

  /** 測試連線 (僅限 SYS_ADMIN) */
  testConnection(row: HeatSourceDetailResponse): void {
    if (!this.isSysAdmin()) {
      this.snackBar.open('權限不足：僅系統管理員 (SYS_ADMIN) 可執行連線測試', '關閉', { duration: 3000 });
      return;
    }
    if (!row.id) return;

    this.testingSourceIds.update(map => ({ ...map, [row.id!]: true }));
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    this.heatSourceApi.test({ id: row.id }, 'body', false, jsonOptions).subscribe({
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
        const msg = err?.error?.message || err?.message || '連線測試請求失敗';
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
    if (!row.id) return;

    const newEnabled = !row.enabled;
    const actionText = newEnabled ? '啟用' : '停用';
    if (!confirm(`確定要${actionText}「${this.getSourceName(row.sourceCode)}」熱度來源嗎？`)) {
      return;
    }

    this.updatingSourceIds.update(map => ({ ...map, [row.id!]: true }));
    const jsonOptions = { httpHeaderAccept: 'application/json' as any };

    this.heatSourceApi.update2(
      { id: row.id, heatSourceUpdateRequest: { enabled: newEnabled } },
      'body',
      false,
      jsonOptions
    ).subscribe({
      next: () => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        this.snackBar.open(`已${actionText}「${this.getSourceName(row.sourceCode)}」`, '關閉', { duration: 2500 });
        this.loadSources();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        console.error('[HeatSources] 切換啟用狀態失敗:', err);
        const msg = err?.error?.message || err?.message || `${actionText}失敗`;
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
    this.editingWeightId.set(row.id ?? null);
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
    if (!row.id) return;

    const inputVal = this.editWeightInput();
    if (inputVal === null || inputVal === undefined || isNaN(inputVal)) {
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
    ).subscribe({
      next: () => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        this.snackBar.open(
          `「${this.getSourceName(row.sourceCode)}」權重已更新為 ${(newWeight * 100).toFixed(1)}%，系統將非同步重算品項評分`,
          '關閉',
          { duration: 4000 }
        );
        this.cancelEditWeight();
        this.loadSources();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.updatingSourceIds.update(map => ({ ...map, [row.id!]: false }));
        console.error('[HeatSources] 更新權重失敗:', err);
        const msg = err?.error?.message || err?.message || '更新失敗';
        this.snackBar.open(`更新權重失敗: ${msg}`, '關閉', { duration: 4000 });
        this.cdr.markForCheck();
      }
    });
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
