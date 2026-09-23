import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { TrendControllerService, TrendSignalRow } from '../../api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { MOCK_TREND_LIST } from '../../core/mock/trend-mock';

/**
 * 繁體中文語系設定 - Material 分頁器
 */
export function getZhPaginatorIntl(): MatPaginatorIntl {
  const intl = new MatPaginatorIntl();
  intl.itemsPerPageLabel = '每頁筆數：';
  intl.nextPageLabel = '下一頁';
  intl.previousPageLabel = '上一頁';
  intl.firstPageLabel = '第一頁';
  intl.lastPageLabel = '最後一頁';
  intl.getRangeLabel = (page: number, pageSize: number, length: number) => {
    if (length === 0 || pageSize === 0) {
      return `0 / 共 ${length} 筆`;
    }
    const startIndex = page * pageSize;
    const endIndex = startIndex < length ? Math.min(startIndex + pageSize, length) : startIndex + pageSize;
    return `${startIndex + 1} – ${endIndex} / 共 ${length} 筆`;
  };
  return intl;
}

@Component({
  selector: 'app-trends',
  imports: [
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule
  ],
  providers: [
    { provide: MatPaginatorIntl, useFactory: getZhPaginatorIntl }
  ],
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
  searchQuery = signal<string>('');
  aiFilter = signal<'ALL' | 'NORMAL' | 'WARN'>('ALL');

  // 分頁控制 Signals
  pageIndex = signal<number>(0);
  pageSize = signal<number>(10);
  readonly pageSizeOptions: number[] = [5, 10, 20, 50];

  filteredTrends = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.aiFilter();
    let list = this.trendList();

    if (q) {
      list = list.filter((item) => (item.keyword ?? '').toLowerCase().includes(q));
    }

    if (filter === 'NORMAL') {
      list = list.filter((item) => !item.divergenceFlag);
    } else if (filter === 'WARN') {
      list = list.filter((item) => !!item.divergenceFlag);
    }

    return list;
  });

  paginatedTrends = computed(() => {
    const list = this.filteredTrends();
    const size = this.pageSize();
    const maxPage = Math.max(0, Math.ceil(list.length / size) - 1);
    const current = Math.min(this.pageIndex(), maxPage);
    const start = current * size;
    return list.slice(start, start + size);
  });

  ngOnInit() {
    this.loadTrends();
  }

  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    this.pageIndex.set(0);
  }

  onFilterChange(filter: 'ALL' | 'NORMAL' | 'WARN'): void {
    this.aiFilter.set(filter);
    this.pageIndex.set(0);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.aiFilter.set('ALL');
    this.pageIndex.set(0);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
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
          this.pageIndex.set(0);
        },
        error: (err) => {
          console.warn('[TrendsComponent] 後端 API 請求失敗，自動使用 Mock 假資料回退:', err);
          this.trendList.set(MOCK_TREND_LIST);
          this.isLoading.set(false);
          this.pageIndex.set(0);
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

  formatSlope(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const percentage = Math.round(value * 100);
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage}%`;
  }
}
