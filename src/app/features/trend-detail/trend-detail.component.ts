import { Component, inject, signal, DestroyRef, ElementRef, ViewChild } from '@angular/core';
import { TrendControllerService, TrendKeywordDetailResponse } from '../../api';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-trend-detail',
  imports: [],
  templateUrl: './trend-detail.component.html',
  styleUrl: './trend-detail.component.scss',
})
export class TrendDetailComponent {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  private route = inject(ActivatedRoute);
  private readonly trendService = inject(TrendControllerService)
  private readonly router = inject(Router)
  private readonly destroyRef = inject(DestroyRef)
  isLoading = signal(false)
  errorMessage = signal<string | null>(null)
  trendData = signal<TrendKeywordDetailResponse | null>(null)

  ngOnInit(): void {
    const rawid = this.route.snapshot.paramMap.get('keywordId')
    const keywordId = Number(rawid)
    if (!rawid || isNaN(keywordId)) {
      this.errorMessage.set('無效關鍵字ID');
      return;
    }
    this.loadTrendDetail(keywordId);

  }

  loadTrendDetail(keywordId: number) {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.trendService.getKeywordDetail({ keywordId }).
      pipe(takeUntilDestroyed(this.destroyRef)).
      subscribe({
        next: (res) => {
          this.trendData.set(res);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set('載入失敗,請稍後再嘗試!');
          this.isLoading.set(false);
        }
      })
  }

  goBack(): void {
    this.router.navigate(['/trends']);
  }

  DataSetting: string[] = [
    '近90天', '近60天', '近30天'
  ]



}
