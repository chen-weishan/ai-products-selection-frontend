import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { DashboardControllerService } from '../../api/api/dashboardController.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  dashboardSummary: any = {};
  viralRankings: any[] = [];
  festivalRankings: any[] = [];
  replenishmentRankings: any[] = [];
  seasonalRankings: any[] = [];
  sourcingSummary: any = { items: [] };
  overdueCampaigns: any[] = [];
  heatSources: any[] = [];
  weeklyNewCount = 9;
  activeTab: string = 'viral';
  activeTrack: string = 'A';
  activePeriod: 'week' | 'lastWeek' | 'custom' = 'week';

  readonly sceneMap: Record<string, string> = {
    VIRAL: '話題爆款',
    FESTIVAL: '節慶檔期',
    REPLENISHMENT: '常態補貨',
    SEASONAL: '季節導向'
  };

  constructor(private dashboardService: DashboardControllerService, private router: Router) {}

  get currentPeriodDisplay(): string {
    const period = this.getIsoWeekStringForPeriod(this.activePeriod);
    const year = period.substring(0, 4);
    const week = period.substring(4);
    return `${year} / ${week}`;
  }

  /** 解析可能為 Blob 的 API 回應 */
  private async unpack<T = any>(raw: any): Promise<T> {
    if (raw instanceof Blob) {
      try {
        const text = await raw.text();
        return JSON.parse(text);
      } catch (e) {
        console.error('[DashboardComponent] 解析 Blob 失敗:', e);
        return raw as T;
      }
    }
    return raw as T;
  }

  /** 根據 activePeriod 回傳對應的 ISO 週字串 (如 2026W30) */
  private getIsoWeekStringForPeriod(period: 'week' | 'lastWeek' | 'custom'): string {
    const now = new Date();
    if (period === 'week') {
      return this.getIsoWeekString(now);
    } else if (period === 'lastWeek') {
      return this.getIsoWeekString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else {
      return this.getIsoWeekString(now);
    }
  }

  /** 計算指定日期所屬的 ISO 星期字串 (YYYYWww) */
  private getIsoWeekString(date: Date): string {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const jan4 = new Date(target.getFullYear(), 0, 4);
    const dayDiff = (target.getTime() - jan4.getTime()) / 86400000;
    const weekNr = 1 + Math.ceil(dayDiff / 7);
    return `${target.getFullYear()}W${weekNr.toString().padStart(2, '0')}`;
  }

  /** 將 sourceCode 映射為可讀名稱 */
  public getSourceName(sourceCode: string): string {
    switch (sourceCode) {
      case 'THREADS':
        return 'Threads';
      case 'GOOGLE_TRENDS':
        return 'Google Trends';
      case 'INSTAGRAM':
        return 'Instagram';
      case 'MANUAL':
        return '人工標記';
      default:
        return sourceCode;
    }
  }

  /** 格式化最後更新時間為簡單顯示（例如：今日 06:00） */
  public getLastFetchedTime(lastFetchedAt: string): string {
    if (!lastFetchedAt) {
      return '未知';
    }
    try {
      const date = new Date(lastFetchedAt);
      const now = new Date();
      
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return `今日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();
      if (isYesterday) {
        return `昨日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return lastFetchedAt;
    }
  }

  /** 導航到快速標記入口頁面（FR-14-1） */
  public navigateToQuickMark(): void {
    this.router.navigate(['/heat-tags']);
  }

  /** 導航到熱度來源設定頁面（S-16） */
  public navigateToSourceSettings(): void {
    this.router.navigate(['/heat-sources']);
  }

  /** 導航到尋源優先序頁面（S-18） */
  public navigateToSourcingSummary(): void {
    this.router.navigate(['/sourcing-queue']);
  }

  /** 點擊商品名稱導航至品項頁面 */
  public navigateToProduct(productId: number | undefined): void {
    if (productId) {
      this.router.navigate(['/products'], { queryParams: { id: productId } });
    }
  }

  /** 重新載入儀表板資料 */
  public reload(): void {
    this.loadDashboardData();
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    const periodParam = this.getIsoWeekStringForPeriod(this.activePeriod);
    console.log('Loading dashboard data for period:', periodParam, 'track:', this.activeTrack);

    // 1. KPI 彙總（固定查 A 軌）
    this.dashboardService.getSummary({ track: 'A', period: periodParam }).subscribe({
      next: async (raw: any) => {
        const response = await this.unpack(raw);
        console.log('Dashboard summary response:', response);
        const data = response?.data || response;
        if (data && (data.kpi || data.totalCandidates !== undefined)) {
          this.dashboardSummary = data.kpi || data;
          this.weeklyNewCount = data.weeklyNewCount ?? 9;
        } else {
          this.loadMockSummary();
        }
      },
      error: (error: any) => {
        console.error('Failed to load dashboard summary:', error);
        this.loadMockSummary();
      }
    });

    // 2. 四榜排行（後端一支 API 回傳四大情境榜單）
    const trackParam = this.activeTrack === 'A' ? 'A' : 'B';
    this.dashboardService.getRankings({ track: trackParam, limit: 5, period: periodParam } as any).subscribe({
      next: async (raw: any) => {
        const response = await this.unpack(raw);
        console.log('Rankings response:', response);
        const data = response?.data || response;
        if (data) {
          this.viralRankings = data.viral || [];
          this.festivalRankings = data.festival || [];
          this.replenishmentRankings = data.replenishment || [];
          this.seasonalRankings = data.seasonal || [];
        } else {
          this.loadMockRankings();
        }
      },
      error: (error: any) => {
        console.error('Failed to load rankings:', error);
        this.loadMockRankings();
      }
    });

    // 3. B 軌尋源中摘要
    if (this.activeTrack === 'B') {
      this.dashboardService.getSourcingSummary({ limit: 5 }).subscribe({
        next: async (raw: any) => {
          const response = await this.unpack(raw);
          console.log('Sourcing summary response:', response);
          const data = response?.data || response;
          if (data && data.items) {
            this.sourcingSummary = data;
          } else {
            this.loadMockSourcingSummary();
          }
        },
        error: (error: any) => {
          console.error('Failed to load sourcing summary:', error);
          this.loadMockSourcingSummary();
        }
      });
    } else {
      this.sourcingSummary = { items: [] };
    }

    // 4. 待回填結案
    this.dashboardService.getTodos().subscribe({
      next: async (raw: any) => {
        const response = await this.unpack(raw);
        console.log('Overdue campaigns response:', response);
        const data = response?.data || response;
        if (data && data.overdueCampaigns) {
          this.overdueCampaigns = data.overdueCampaigns;
        } else {
          this.overdueCampaigns = this.getMockOverdueCampaigns();
        }
      },
      error: (error: any) => {
        console.error('Failed to load overdue campaigns:', error);
        this.overdueCampaigns = this.getMockOverdueCampaigns();
      }
    });

    // 5. 熱度來源狀態
    this.dashboardService.getHeatSources().subscribe({
      next: async (raw: any) => {
        const response = await this.unpack(raw);
        console.log('Heat sources response:', response);
        const data = response?.data || response;
        if (data && data.items) {
          this.heatSources = data.items;
        } else {
          this.heatSources = this.getMockHeatSources();
        }
      },
      error: (error: any) => {
        console.error('Failed to load heat sources:', error);
        this.heatSources = this.getMockHeatSources();
      }
    });
  }

  /** Mock data for development when backend is unavailable */
  private loadMockSummary(): void {
    this.dashboardSummary = {
      totalCandidates: 128,
      aGradeCount: 27,
      openRiskCount: 7,
      overdueFeedbackCount: 3
    };
    this.weeklyNewCount = 9;
  }

  private loadMockRankings(): void {
    this.loadMockViralRankings();
    this.loadMockFestivalRankings();
    this.loadMockReplenishmentRankings();
    this.loadMockSeasonalRankings();
  }

  private loadMockViralRankings(): void {
    this.viralRankings = [
      { productId: 1, productName: 'Threads 神祕款', finalScore: 95, grade: 'A', sceneType: 'VIRAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 2, productName: 'Google Trends 熱搜', finalScore: 92, grade: 'A', sceneType: 'VIRAL', sceneOverridden: true, riskLevel: 'LOW' },
      { productId: 3, productName: 'Instagram 爆款', finalScore: 88, grade: 'B', sceneType: 'VIRAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 4, productName: '人工標記 精選', finalScore: 85, grade: 'B', sceneType: 'VIRAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 5, productName: 'Threads 新品', finalScore: 80, grade: 'C', sceneType: 'VIRAL', sceneOverridden: false, riskLevel: 'LOW' }
    ];
  }

  private loadMockFestivalRankings(): void {
    this.festivalRankings = [
      { productId: 10, productName: '雙節禮盒', finalScore: 94, grade: 'A', sceneType: 'FESTIVAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 11, productName: '中秋月餐', finalScore: 90, grade: 'A', sceneType: 'FESTIVAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 12, productName: '端午粽子', finalScore: 87, grade: 'B', sceneType: 'FESTIVAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 13, productName: '聖誕禮物', finalScore: 83, grade: 'B', sceneType: 'FESTIVAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 14, productName: '元旦禮盒', finalScore: 80, grade: 'C', sceneType: 'FESTIVAL', sceneOverridden: false, riskLevel: 'LOW' }
    ];
  }

  private loadMockReplenishmentRankings(): void {
    this.replenishmentRankings = [
      { productId: 20, productName: '基礎 T 恤', finalScore: 93, grade: 'A', sceneType: 'REPLENISHMENT', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 21, productName: '經典牛仔褲', finalScore: 90, grade: 'A', sceneType: 'REPLENISHMENT', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 22, productName: '白色襯衫', finalScore: 88, grade: 'B', sceneType: 'REPLENISHMENT', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 23, productName: '黑色西裝', finalScore: 85, grade: 'B', sceneType: 'REPLENISHMENT', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 24, productName: '休閒短褲', finalScore: 82, grade: 'C', sceneType: 'REPLENISHMENT', sceneOverridden: false, riskLevel: 'LOW' }
    ];
  }

  private loadMockSeasonalRankings(): void {
    this.seasonalRankings = [
      { productId: 30, productName: '夏季防曬衣', finalScore: 96, grade: 'A', sceneType: 'SEASONAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 31, productName: '冬季保暖外套', finalScore: 92, grade: 'A', sceneType: 'SEASONAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 32, productName: '春季薄外套', finalScore: 89, grade: 'B', sceneType: 'SEASONAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 33, productName: '秋季針織衫', finalScore: 85, grade: 'B', sceneType: 'SEASONAL', sceneOverridden: false, riskLevel: 'LOW' },
      { productId: 34, productName: '四季通用襪子', finalScore: 80, grade: 'C', sceneType: 'SEASONAL', sceneOverridden: false, riskLevel: 'LOW' }
    ];
  }

  private loadMockSourcingSummary(): void {
    this.sourcingSummary = {
      items: [
        { productId: 40, productName: '新興供應商 A', timeGapDays: 2 },
        { productId: 41, productName: '新興供應商 B', timeGapDays: 5 },
        { productId: 42, productName: '新興供應商 C', timeGapDays: -1 } // 淘汰
      ]
    };
  }

  private getMockOverdueCampaigns(): any[] {
    return [
      { productName: '過期活動 1', overdueDays: 10 },
      { productName: '過期活動 2', overdueDays: 5 },
      { productId: 3, productName: '過期活動 3', overdueDays: 2 }
    ];
  }

  private getMockHeatSources(): any[] {
    return [
      { sourceCode: 'THREADS', sourceName: 'Threads', lastFetchedAt: new Date().toISOString(), availability: 'AVAILABLE', quotaUsed: 120, quotaLimit: 150 },
      { sourceCode: 'GOOGLE_TRENDS', sourceName: 'Google Trends', lastFetchedAt: new Date(Date.now() - 3600000).toISOString(), availability: 'AVAILABLE', quotaUsed: 45, quotaLimit: 100 },
      { sourceCode: 'INSTAGRAM', sourceName: 'Instagram', lastFetchedAt: new Date(Date.now() - 7200000).toISOString(), availability: 'DEGRADED', quotaUsed: 26, quotaLimit: 30 },
      { sourceCode: 'MANUAL', sourceName: '人工標記', lastFetchedAt: new Date().toISOString(), availability: 'AVAILABLE', quotaUsed: 12, quotaLimit: null }
    ];
  }

  switchTrack(track: string): void {
    if (this.activeTrack !== track) {
      this.activeTrack = track;
      console.log('Switching track to:', track);
      this.loadDashboardData(); // Reload data based on new track
    }
  }

  switchPeriod(period: 'week' | 'lastWeek' | 'custom'): void {
    if (this.activePeriod !== period) {
      this.activePeriod = period;
      console.log('Switching period to:', period);
      this.loadDashboardData(); // Reload data based on new period
    }
  }

  getRankingsForTab(tab: string): any[] {
    switch (tab) {
      case 'festival':
        return this.festivalRankings;
      case 'replenishment':
        return this.replenishmentRankings;
      case 'seasonal':
        return this.seasonalRankings;
      default:
        return this.viralRankings;
    }
  }

  getTabLabel(tab: string): string {
    switch (tab) {
      case 'festival':
        return '節慶檔期榜';
      case 'replenishment':
        return '常態補貨榜';
      case 'seasonal':
        return '季節導向榜';
      default:
        return '話題爆款榜';
    }
  }

  getPeriodLabel(period: string): string {
    switch (period) {
      case 'week':
        return '本週';
      case 'lastWeek':
        return '上週';
      case 'custom':
        return '自訂區間';
      default:
        return '本週';
    }
  }
}
