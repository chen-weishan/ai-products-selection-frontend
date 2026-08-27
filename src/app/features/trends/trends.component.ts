import { Component, DestroyRef, inject, signal } from '@angular/core';
import { TrendControllerService, TrendSignalProjection } from '../../api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TrendDetailComponent } from '../trend-detail/trend-detail.component';

@Component({
  selector: 'app-trends',
  imports: [MatTableModule, RouterLink],
  templateUrl: './trends.component.html',
  styleUrl: './trends.component.scss'
})
export class TrendsComponent {
  private readonly trendService = inject(TrendControllerService)
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  trendList = signal<TrendSignalProjection[]>([]);



  ngOnInit() {
    this.loadTrends();
  }

  loadTrends() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.trendService.getTrends().
      pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.trendList.set(res);
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set('載入失敗,請稍後再嘗試!');
          this.isLoading.set(false);
        }
      })
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
