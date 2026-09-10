import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { TrendControllerService, TrendSignalRow } from '../../api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MOCK_TREND_LIST } from '../../core/mock/trend-mock';

@Component({
  selector: 'app-trends',
  imports: [MatTableModule],
  templateUrl: './trends.component.html',
  styleUrl: './trends.component.scss'
})
export class TrendsComponent implements OnInit {
  private readonly trendService = inject(TrendControllerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  trendList = signal<TrendSignalRow[]>([]);

  ngOnInit() {
    this.loadTrends();
  }

  loadTrends() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.trendService.getTrends()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.trendList.set(res && res.length > 0 ? res : MOCK_TREND_LIST);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.warn('[TrendsComponent] 後端 API 請求失敗，自動使用 Mock 假資料回退:', err);
          this.trendList.set(MOCK_TREND_LIST);
          this.isLoading.set(false);
        }
      });
  }

  displayedColumns: string[] = [
    'keyword',
    'heatToday',
    'slope7d',
    'slope30d',
    'aiSignal'
  ];

  goToDetail(keywordId: number | string): void {
    if (keywordId === null || keywordId === undefined) { console.warn('沒有對應資料'); return; };
    this.router.navigate(['/trends', keywordId]);
  }
}
