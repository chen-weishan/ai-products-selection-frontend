import {
  Component,
  inject,
  signal,
  DestroyRef,
  ElementRef,
  OnInit,
  OnDestroy,
  computed,
  viewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Chart } from 'chart.js/auto';
import { MatTableModule } from '@angular/material/table';

import {
  Point,
  SourceDetail,
  TrendControllerService,
  TrendKeywordDetailResponse,
} from '../../api';
import { getMockTrendDetail } from '../../core/mock/trend-mock';

type DateRange = '90d' | '60d' | '30d';

@Component({
  selector: 'app-trend-detail',
  imports: [CommonModule, MatTableModule, RouterModule],
  templateUrl: './trend-detail.component.html',
  styleUrl: './trend-detail.component.scss',
})
export class TrendDetailComponent implements OnInit, OnDestroy {
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas');

  private readonly route = inject(ActivatedRoute);
  private readonly trendService = inject(TrendControllerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private chart: Chart | null = null;

  constructor() {
    effect(() => {
      const canvas = this.chartCanvas();
      const data = this.trendData();
      if (canvas?.nativeElement && data?.points && data.points.length > 0) {
        // Wait for the browser to paint so that Chart.js can read the container dimensions correctly
        setTimeout(() => {
          this.renderChart(data.points!);
        }, 0);
      }
    });
  }

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  trendData = signal<TrendKeywordDetailResponse | null>(null);
  currentkeywordId = signal<number | null>(null);
  selectedRange = signal<DateRange>('90d');
  readonly dateRangeOptions: { label: string; value: DateRange }[] = [
    { label: '近90天', value: '90d' },
    { label: '近60天', value: '60d' },
    { label: '近30天', value: '30d' },
  ];

  readonly stageMap: Record<string, string> = {
    RISING: '上升期',
    PLATEAU: '高原期',
    DECLINING: '衰退期'
  };

  readonly statusMap: Record<string, string> = {
    AVAILABLE: '正常',
    INSUFFICIENT_DATA: '數據不足',
    INSUFFICIENT_QUOTA: '額度不足',
    NO_DATA: '無資料',
    UNAVAILABLE: '異常',
    DEGRADED: '降級',
    SYNCING: '同步中'
  };

  displayedColumns: string[] = [
    'sourceName',
    'slope7d',
    'slope30d',
    'percentile',
    'appliedWeight',
    'status'
  ];

  formatSlope(val: number | undefined | null): string {
    if (val === undefined || val === null) return '-';
    const percent = Math.round(val * 100);
    return percent > 0 ? `+${percent}%` : `${percent}%`;
  }

  formatWeight(val: number | undefined | null, status?: string): string {
    if (status === 'NO_DATA' || val === undefined || val === null) return '-';
    return `${Math.round(val * 100)}%`;
  }

  formatPercentile(val: number | undefined | null): string {
    if (val === undefined || val === null) return '-';
    return `${Math.round(val)}%`;
  }

  getSourceStatusBadgeClass(status?: string | null): string {
    if (!status) return 'status-secondary';
    switch (status) {
      case 'AVAILABLE':
      case '正常':
        return 'status-normal';
      case 'INSUFFICIENT_QUOTA':
      case 'INSUFFICIENT_DATA':
      case '額度不足':
      case '數據不足':
        return 'status-quota';
      case 'DEGRADED':
      case 'UNAVAILABLE':
      case '降級':
      case '異常':
        return 'status-warn';
      case 'NO_DATA':
      case '無資料':
      default:
        return 'status-secondary';
    }
  }

  getAbnormalSources() {
    const sources = this.trendData()?.sourceDetails || [];
    return sources.filter(
      s => s.status && s.status !== 'AVAILABLE' && s.status !== 'NO_DATA'
    );
  }

  formatSourceName(name: string | undefined): string {
    if (!name) return '';
    const upper = name.toUpperCase();
    if (upper === 'MANUAL' || upper.includes('人工')) return '人工標記';
    if (upper === 'GOOGLE_TRENDS' || upper === 'GOOGLE') return 'Google Trends';
    if (upper === 'THREADS') return 'Threads';
    if (upper === 'INSTAGRAM') return 'Instagram';
    return name;
  }

  getAppliedWeightsSummary(): string {
    const sources = this.trendData()?.sourceDetails || [];
    const activeSources = sources.filter(
      s => s.appliedWeight && s.appliedWeight > 0
    );
    if (activeSources.length === 0) return '本次合成：尚無有效權重';

    const parts = activeSources.map(s => {
      const weightPercent = Math.round((s.appliedWeight ?? 0) * 1000) / 10;
      return `${this.formatSourceName(s.sourceName)} ${weightPercent}%`;
    });
    return `本次合成：${parts.join(' ・ ')}`;
  }

  getDefaultWeightsSummary(): string {
    return '預設合成：Threads 35% ・ Google Trends 30% ・ 人工標記 20% ・ Instagram 15%';
  }

  normalizeSourceDetails(sources: SourceDetail[] | undefined): SourceDetail[] {
    const rawList = sources || [];

    const canonicalConfigs: Array<{
      key: string;
      displayName: string;
      subName?: string;
      categoryLevel: boolean;
      isManual?: boolean;
      matcher: (name: string) => boolean;
    }> = [
      {
        key: 'THREADS',
        displayName: 'Threads',
        categoryLevel: false,
        matcher: (n) => n.toUpperCase().includes('THREAD'),
      },
      {
        key: 'GOOGLE_TRENDS',
        displayName: 'Google Trends',
        categoryLevel: false,
        matcher: (n) => {
          const u = n.toUpperCase();
          return u.includes('GOOGLE') || u === 'GOOGLE_TRENDS' || u === 'TRENDS';
        },
      },
      {
        key: 'INSTAGRAM',
        displayName: 'Instagram',
        subName: '(品類)',
        categoryLevel: true,
        matcher: (n) => {
          const u = n.toUpperCase();
          return u.includes('INSTAGRAM') || u === 'IG';
        },
      },
      {
        key: 'MANUAL',
        displayName: '人工標記',
        categoryLevel: false,
        isManual: true,
        matcher: (n) => {
          const u = n.toUpperCase();
          return u.includes('MANUAL') || u.includes('人工');
        },
      },
    ];

    const matchedCanonical = canonicalConfigs.map((cfg) => {
      const found = rawList.find(
        (s) => s.sourceName && cfg.matcher(s.sourceName)
      );

      if (found) {
        return {
          ...found,
          sourceName: cfg.displayName,
          subName: (found as any).subName || cfg.subName,
          categoryLevel: found.categoryLevel ?? cfg.categoryLevel,
          isManual: cfg.isManual || (found as any).isManual,
          status: found.status || 'AVAILABLE',
          appliedWeight: found.appliedWeight ?? 0,
        };
      }

      // 沒出現在後端的來源，補上 status: 'NO_DATA'
      return {
        sourceName: cfg.displayName,
        subName: cfg.subName,
        status: 'NO_DATA',
        percentile: undefined,
        appliedWeight: 0,
        slope7d: undefined,
        slope30d: undefined,
        categoryLevel: cfg.categoryLevel,
        isManual: cfg.isManual,
      } as SourceDetail;
    });

    // 保留非四大標準來源的其他額外資料（若有）
    const extraSources = rawList.filter(
      (s) => !s.sourceName || !canonicalConfigs.some((cfg) => cfg.matcher(s.sourceName!))
    );

    return [...matchedCanonical, ...extraSources];
  }


  ngOnInit(): void {
    const rawid = this.route.snapshot.paramMap.get('keywordId');
    const keywordId = Number(rawid);
    if (!rawid || isNaN(keywordId)) {
      this.errorMessage.set('無效關鍵字ID');
      return;
    }
    this.currentkeywordId.set(keywordId);
    this.loadTrendDetail();
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  loadTrendDetail(): void {
    const keywordId = this.currentkeywordId();
    if (!keywordId) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.trendService
      .getKeywordDetail(
        {
          keywordId,
          range: this.selectedRange(),
        },
        'body',
        false,
        { httpHeaderAccept: 'application/json' as any }
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (res) => {
          let data = res;
          if (data instanceof Blob) {
            try {
              const text = await (data as Blob).text();
              data = JSON.parse(text);
            } catch (e) {
              console.error('[TrendDetailComponent] 解析 Blob 失敗:', e);
            }
          }
          if (data) {
            data.sourceDetails = this.normalizeSourceDetails(data.sourceDetails);
          }
          this.trendData.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.warn('[TrendDetailComponent] 後端 API 請求失敗，自動使用 Mock 假資料回退:', err);
          const mockData = getMockTrendDetail(keywordId, this.selectedRange());
          if (mockData) {
            mockData.sourceDetails = this.normalizeSourceDetails(mockData.sourceDetails);
          }
          this.trendData.set(mockData);
          this.isLoading.set(false);
        },
      });
  }

  onRangeChange(range: DateRange): void {
    if (this.selectedRange() === range) return;
    this.selectedRange.set(range);
    this.loadTrendDetail();
  }

  renderChart(points: Point[]): void {
    const canvas = this.chartCanvas();
    if (!canvas?.nativeElement) {
      console.warn('Canvas元素尚未準備好');
      return;
    }

    const ctx = canvas.nativeElement.getContext('2d');
    if (!ctx) return;

    if (this.chart) {
      this.chart.destroy();
    }

    const labels = points.map((p) => p.date ?? '');
    const dataValues = points.map((p) => p.compositeValue ?? 0);

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '綜合熱度指數',
            data: dataValues,
            borderColor: '#3b82f6',
            backgroundColor: gradient,
            borderWidth: 2.5,
            pointRadius: points.length > 40 ? 0 : 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3b82f6',
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleFont: { size: 13 },
            bodyFont: { size: 14, weight: 'bold' },
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (context) => ` 熱度值: ${context.parsed.y}`,
            },
          },
        },
        scales: {
          x: {
            grid: {
              display: false,
            },
            ticks: {
              maxTicksLimit: 8,
              color: '#64748b',
            },
          },
          y: {
            grid: {
              color: '#f1f5f9',
            },
            ticks: {
              color: '#64748b',
            },
          },
        },
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/trends']);
  }

  latesDate = computed(() => {
    const date = this.trendData()?.points;
    return date && date.length > 0 ? date[date.length - 1].date : '無';
  })
}
