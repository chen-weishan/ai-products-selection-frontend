import {
  Component,
  inject,
  signal,
  DestroyRef,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Chart } from 'chart.js/auto';

import {
  Point,
  TrendControllerService,
  TrendKeywordDetailResponse,
} from '../../api';

type DateRange = '90d' | '60d' | '30d';

@Component({
  selector: 'app-trend-detail',
  imports: [CommonModule],
  templateUrl: './trend-detail.component.html',
  styleUrl: './trend-detail.component.scss',
})
export class TrendDetailComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly trendService = inject(TrendControllerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private chart: Chart | null = null;

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
      .getKeywordDetail({
        keywordId,
        range: this.selectedRange(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.trendData.set(res);
          this.isLoading.set(false);

          setTimeout(() => {
            if (res.points && res.points.length > 0) {
              this.renderChart(res.points);
            }
          });
        },
        error: () => {
          this.errorMessage.set('載入失敗,請稍後再嘗試!');
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
    if (!this.chartCanvas?.nativeElement) {
      console.warn('Canvas元素尚未準備好');
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
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
