import { Component, OnInit } from '@angular/core';
import { DashboardControllerService } from '../api/api/dashboardController.service';
import {
  DashboardKpiResponseDto,
  DashboardRankingsResponseDto,
  DashboardSourcingSummaryResponseDto,
  DashboardTodosResponseDto,
  DashboardHeatSourcesResponseDto,
  KpiDto,
  RankingItemDto,
  BtrackSummaryDto,
  HeatSourceDto,
  OverdueCampaignDto
} from '../api/index';
import { Observable, of, combineLatest } from 'rxjs';
import { map, catchError, startWith } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  // UI state
  track: 'A' | 'B' = 'A';
  periodOptions = ['本週', '上週', '自訂區間'];
  selectedPeriodOption: string = '本週';
  customStart: string = '';
  customEnd: string = '';
  activeTab: string = 'viral';
  
  // Data
  kpi$: Observable<{totalCandidates: number; aGradeCount: number; highRiskCount: number; overdueCount: number; scoringExecuted: boolean}>;
  rankings$: Observable<{
    viral: RankingItemDto[];
    festival: RankingItemDto[];
    replenishment: RankingItemDto[];
    seasonal: RankingItemDto[];
  }>;
  btrackSummary$: Observable<BtrackSummaryDto[]>;
  todos$: Observable<OverdueCampaignDto[]>;
  heatSources$: Observable<HeatSourceDto[]>;

  // Helper: get current week string in format YYYYWww (Asia/Taipei)
  private getCurrentWeek(): string {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // Not reliable; we can use UTC offset? For simplicity, we assume the frontend runs in Taipei timezone.
    // Better: use Luxon or moment-timezone, but not available. We'll approximate using JS Date and offset.
    // We'll compute using UTC and adjust? For demo, we'll just use new Date().toISOString() and extract week.
    // We'll implement a simple function that returns week number using ISO week (week starts Monday).
    const now = new Date();
    // Convert to Taipei time (UTC+8)
    const taipeiOffset = 8 * 60; // minutes
    const localTime = now.getTime() + (now.getTimezoneOffset() * 60000); // UTC time in ms
    const taipeiTime = localTime + (taipeiOffset * 60000);
    const taipeiDate = new Date(taipeiTime);
    const day = taipeiDate.getDay() === 0 ? 7 : taipeiDate.getDay(); // Monday = 1
    const diff = taipeiDate.getDate() - day + 3; // Wednesday of this week as reference
    const week1 = new Date(taipeiDate.getFullYear(), 0, 4); // Jan 4 is always in week 1 (ISO)
    const weekNumber = Math.ceil((((diff - week1.getTime()) / 86400000) + 1) / 7);
    const year = taipeiDate.getFullYear();
    return `${year}W${String(weekNumber).padStart(2, '0')}`;
  }

  // Get period string based on selection
  get period(): string {
    if (this.selectedPeriodOption === '本週') {
      return this.getCurrentWeek();
    }
    if (this.selectedPeriodOption === '上週') {
      // compute previous week
      const now = new Date();
      const taipeiOffset = 8 * 60;
      const localTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const taipeiTime = localTime + (taipeiOffset * 60000);
      const taipeiDate = new Date(taipeiTime);
      const day = taipeiDate.getDay() === 0 ? 7 : taipeiDate.getDay();
      const diff = taipeiDate.getDate() - day + 3;
      const week1 = new Date(taipeiDate.getFullYear(), 0, 4);
      const weekNumber = Math.ceil((((diff - week1.getTime()) / 86400000) + 1) / 7);
      let year = taipeiDate.getFullYear();
      let week = weekNumber - 1;
      if (week < 1) {
        // previous year last week
        const dec28 = new Date(year - 1, 11, 28); // Dec 28 always in last week of ISO year
        const day28 = dec28.getDay() === 0 ? 7 : dec28.getDay();
        const diff28 = dec28.getDate() - day28 + 3;
        const week1prev = new Date(year - 1, 0, 4);
        const weekNumPrev = Math.ceil((((diff28 - week1prev.getTime()) / 86400000) + 1) / 7);
        week = weekNumPrev;
        year = year - 1;
      }
      return `${year}W${String(week).padStart(2, '0')}`;
    }
    // custom: we could combine start and end, but backend expects single period like 2026W30.
    // For simplicity, we ignore custom and fallback to current week.
    return this.getCurrentWeek();
  }

  constructor(private dashboardService: DashboardControllerService) {
    // KPI: map response
    this.kpi$ = this.dashboardService.getSummary({ period: this.period, track: this.track }).pipe(
      map(res => {
        if (res?.data) {
          const dto = res.data;
          return {
            totalCandidates: dto?.kpi?.totalCandidates ?? 0,
            aGradeCount: dto?.kpi?.aGradeCount ?? 0,
            highRiskCount: dto?.kpi?.openRiskCount ?? 0,
            overdueCount: dto?.kpi?.overdueFeedbackCount ?? 0,
            scoringExecuted: dto?.scoringExecuted ?? false
          };
        }
        return { totalCandidates: 0, aGradeCount: 0, highRiskCount: 0, overdueCount: 0, scoringExecuted: false };
      }),
      catchError(() => of({ totalCandidates: 0, aGradeCount: 0, highRiskCount: 0, overdueCount: 0, scoringExecuted: false }))
    );

    // Rankings: get all four boards
    this.rankings$ = this.dashboardService.getRankings({ period: this.period, track: this.track, limit: 5 }).pipe(
      map(res => {
        if (res?.data) {
          const dto = res.data;
          return {
            viral: dto?.viral ?? [],
            festival: dto?.festival ?? [],
            replenishment: dto?.replenishment ?? [],
            seasonal: dto?.seasonal ?? []
          };
        }
        return { viral: [], festival: [], replenishment: [], seasonal: [] };
      }),
      catchError(() => of({ viral: [], festival: [], replenishment: [], seasonal: [] }))
    );

    // B-track summary
    this.btrackSummary$ = this.dashboardService.getSourcingSummary({ limit: 3 }).pipe(
      map(res => res?.data?.items ?? []),
      catchError(() => of([]))
    );

    // Todos (overdue campaigns)
    this.todos$ = this.dashboardService.getTodos().pipe(
      map(res => res?.data?.overdueCampaigns ?? []),
      catchError(() => of([]))
    );

    // Heat sources
    this.heatSources$ = this.dashboardService.getHeatSources().pipe(
      map(res => res?.data?.items ?? []),
      catchError(() => of([]))
    );
  }

  ngOnInit(): void {
    // Initial load already done in constructor via observables initialization
  }

  onQuickMark(): void {
    alert('快速標記入口：將導向 FR-14-1（尚未實作）');
  }

  reloadData(): void {
    // Re-create observables with current track/period
    this.kpi$ = this.dashboardService.getSummary({ period: this.period, track: this.track }).pipe(
      map(res => {
        if (res?.data) {
          const dto = res.data;
          return {
            totalCandidates: dto?.kpi?.totalCandidates ?? 0,
            aGradeCount: dto?.kpi?.aGradeCount ?? 0,
            highRiskCount: dto?.kpi?.openRiskCount ?? 0,
            overdueCount: dto?.kpi?.overdueFeedbackCount ?? 0,
            scoringExecuted: dto?.scoringExecuted ?? false
          };
        }
        return { totalCandidates: 0, aGradeCount: 0, highRiskCount: 0, overdueCount: 0, scoringExecuted: false };
      }),
      catchError(() => of({ totalCandidates: 0, aGradeCount: 0, highRiskCount: 0, overdueCount: 0, scoringExecuted: false }))
    );

    this.rankings$ = this.dashboardService.getRankings({ period: this.period, track: this.track, limit: 5 }).pipe(
      map(res => {
        if (res?.data) {
          const dto = res.data;
          return {
            viral: dto?.viral ?? [],
            festival: dto?.festival ?? [],
            replenishment: dto?.replenishment ?? [],
            seasonal: dto?.seasonal ?? []
          };
        }
        return { viral: [], festival: [], replenishment: [], seasonal: [] };
      }),
      catchError(() => of({ viral: [], festival: [], replenishment: [], seasonal: [] }))
    );
  }

  onTrackChange(): void {
    this.reloadData();
  }

  onPeriodChange(): void {
    this.reloadData();
  }

  // Helper to get scene label
  sceneLabel(scene: string | undefined): string {
    if (!scene) return '';
    const map: any = {
      VIRAL: '話題爆款',
      FESTIVAL: '節慶檔期',
      REPLENISHMENT: '常態補貨',
      SEASONAL: '季節導向'
    };
    return map[scene] ?? scene;
  }

  // Helper to get grade color class
  gradeClass(grade: string | undefined): string {
    if (!grade) return '';
    return `grade-${grade.toLowerCase()}`;
  }
}
