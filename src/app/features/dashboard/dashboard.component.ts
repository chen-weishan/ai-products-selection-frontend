import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardControllerService } from '../../api/api/dashboardController.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  dashboardSummary: any = {};
  viralRankings: any[] = [];
  festivalRankings: any[] = [];
  replenishmentRankings: any[] = [];
  seasonalRankings: any[] = [];
  sourcingSummary: any = {};
  overdueCampaigns: any[] = [];
  heatSources: any[] = []; // 新增：熱度來源狀態列表
  weeklyNewCount = 9; // This would typically come from API as well
  activeTab: string = 'viral';
  activeTrack: string = 'A'; // A or B
  activePeriod: 'week' | 'lastWeek' | 'custom' = 'week'; // week, lastWeek, custom

  constructor(private dashboardService: DashboardControllerService, private router: Router) {}

  /** 根據 activePeriod 回傳對應的 ISO 週字串 (如 2026W30) */
  private getIsoWeekStringForPeriod(period: 'week' | 'lastWeek' | 'custom'): string {
    const now = new Date();
    if (period === 'week') {
      // 本週 (ISO week)
      return this.getIsoWeekString(now);
    } else if (period === 'lastWeek') {
      // 上週
      return this.getIsoWeekString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else {
      // 自訂區間：規格書未定義 API 如何接受日期範圍，暫時使用本週
      // 實際應該由日期選擇器傳入具備起訖日，此處僅作為備援
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
      
      // 檢查是否是今天
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return `今日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // 檢查是否是昨天
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = date.toDateString() === yesterday.toDateString();
      if (isYesterday) {
        return `昨日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      }
      
      // 其他情況顯示月份和日期
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (e) {
      return lastFetchedAt; // 如果解析失敗，返回原始字符串
    }
  }

  /** 導航到快速標記入口頁面（FR-14-1） */
  public navigateToQuickMark(): void {
    // 根據路由配置推測：快速標記可能對應到 ai-tasks
    this.router.navigate(['/ai-tasks']);
  }

  /** 導航到熱度來源設定頁面（S-16） */
  public navigateToSourceSettings(): void {
    // 根據路由配置推測：熱度來源設定可能對應到 heat-tags
    this.router.navigate(['/heat-tags']);
  }

  /** 導航到尋源優先序頁面（S-18） */
  public navigateToSourcingSummary(): void {
    // 根據路由配置推測：尋源優先序可能對應到 sourcing
    this.router.navigate(['/sourcing']);
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    // Determine period parameter based on activePeriod
    let periodParam = this.getIsoWeekStringForPeriod(this.activePeriod);
    console.log('Loading dashboard data for period:', periodParam, 'track:', this.activeTrack);

    // Load summary data (KPIs) - always show A track data for KPIs as per spec
    this.dashboardService.getSummary({ track: 'A', period: periodParam }).subscribe({
      next: (response: any) => {
        console.log('Dashboard summary response:', response);
        if (response.success && response.data) {
          this.dashboardSummary = response.data.kpi || {};
          // Extract weekly new count from summary if available
          if (response.data.weeklyNewCount !== undefined) {
            this.weeklyNewCount = response.data.weeklyNewCount;
          } else {
              // This is just a placeholder - in reality this would come from the API
              this.weeklyNewCount = 9; 
          }
        } else {
          console.warn('Dashboard summary unsuccessful or missing data:', response);
        }
      },
      error: (error: any) => {
        console.error('Failed to load dashboard summary:', error);
        this.loadMockSummary();
      }
    });

    // Load rankings based on active track and period
    const trackParam = this.activeTrack === 'A' ? 'A' : 'B';
    console.log('Loading rankings for track:', trackParam);

    // Load viral rankings (話題爆款榜)
    this.dashboardService.getRankings({ track: trackParam, scene: 'VIRAL', limit: 5, period: periodParam }).subscribe({
      next: (response: any) => {
        console.log('Viral rankings response:', response);
        if (response.success && response.data) {
          this.viralRankings = response.data.viral || [];
        } else {
          console.warn('Viral rankings unsuccessful or missing data:', response);
        }
      },
      error: (error: any) => {
        console.error('Failed to load viral rankings:', error);
        this.loadMockViralRankings();
      }
    });

    // Load festival rankings (節慶檔期榜)
    this.dashboardService.getRankings({ track: trackParam, scene: 'FESTIVAL', limit: 5, period: periodParam }).subscribe({
      next: (response: any) => {
        console.log('Festival rankings response:', response);
        if (response.success && response.data) {
          this.festivalRankings = response.data.festival || [];
        } else {
          console.warn('Festival rankings unsuccessful or missing data:', response);
        }
      },
      error: (error: any) => {
        console.error('Failed to load festival rankings:', error);
        this.loadMockFestivalRankings();
      }
    });

    // Load replenishment rankings (常態補貨榜)
    this.dashboardService.getRankings({ track: trackParam, scene: 'REPLENISHMENT', limit: 5, period: periodParam }).subscribe({
      next: (response: any) => {
        console.log('Replenishment rankings response:', response);
        if (response.success && response.data) {
          this.replenishmentRankings = response.data.replenishment || [];
        } else {
          console.warn('Replenishment rankings unsuccessful or missing data:', response);
        }
      },
      error: (error: any) => {
        console.error('Failed to load replenishment rankings:', error);
        this.loadMockReplenishmentRankings();
      }
    });

    // Load seasonal rankings (季節導向榜)
    this.dashboardService.getRankings({ track: trackParam, scene: 'SEASONAL', limit: 5, period: periodParam }).subscribe({
      next: (response: any) => {
        console.log('Seasonal rankings response:', response);
        if (response.success && response.data) {
          this.seasonalRankings = response.data.seasonal || [];
        } else {
          console.warn('Seasonal rankings unsuccessful or missing data:', response);
        }
      },
      error: (error: any) => {
        console.error('Failed to load seasonal rankings:', error);
        this.loadMockSeasonalRankings();
      }
    });

    // Load sourcing summary (B 軌摘要) - only relevant for B track
    if (this.activeTrack === 'B') {
      this.dashboardService.getSourcingSummary({ limit: 5 }).subscribe({
        next: (response: any) => {
          console.log('Sourcing summary response:', response);
          if (response.success && response.data) {
            this.sourcingSummary = response.data;
          } else {
            console.warn('Sourcing summary unsuccessful or missing data:', response);
          }
        },
        error: (error: any) => {
          console.error('Failed to load sourcing summary:', error);
          this.loadMockSourcingSummary();
        }
      });
    } else {
      // For A track, show empty sourcing summary
      this.sourcingSummary = { items: [] };
    }

    // Load overdue campaigns (待回填結案) - always show regardless of track
    this.dashboardService.getTodos().subscribe({
      next: (response: any) => {
        console.log('Overdue campaigns response:', response);
        if (response.success && response.data) {
          this.overdueCampaigns = response.data.overdueCampaigns || [];
        } else {
          console.warn('Overdue campaigns unsuccessful or missing data:', response);
        }
      },
      error: (error: any) => {
        console.error('Failed to load overdue campaigns:', error);
        // Provide fallback empty array
        this.overdueCampaigns = this.getMockOverdueCampaigns();
      }
    });

    // Load heat sources status (熱度來源狀態列表)
    this.dashboardService.getHeatSources().subscribe({
      next: (response: any) => {
        console.log('Heat sources response:', response);
        if (response.success && response.data) {
          this.heatSources = response.data.items || [];
        } else {
          console.warn('Heat sources unsuccessful or missing data:', response);
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
