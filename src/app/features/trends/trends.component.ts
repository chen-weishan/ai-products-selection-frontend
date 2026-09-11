import { Component, inject, signal, OnInit } from '@angular/core';
import { TrendSignalRow } from '../../core/models/trend';
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
  private readonly router = inject(Router);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  trendList = signal<TrendSignalRow[]>([]);

  ngOnInit() {
    this.loadTrends();
  }

  loadTrends() {
    this.errorMessage.set(null);
    // 現行後端尚未提供趨勢清單端點，清單頁先保留假資料。
    this.trendList.set(MOCK_TREND_LIST);
    this.isLoading.set(false);
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
