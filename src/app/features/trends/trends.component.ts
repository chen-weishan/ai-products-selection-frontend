import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { ProductReferenceControllerService, TrendControllerService, TrendSignalRow } from '../../api';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { finalize, of, Subscription, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { DialogService } from '../../services/dialog-service';

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
  private readonly keywordService = inject(ProductReferenceControllerService);
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadSubscription?: Subscription;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  trendList = signal<TrendSignalRow[]>([]);
  searchQuery = signal<string>('');
  aiFilter = signal<'ALL' | 'NORMAL' | 'WARN'>('ALL');
  enabledFilter = signal<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');
  readonly canManageKeywords = this.authService.canManageImports;
  readonly pendingKeywordIds = signal<ReadonlySet<number>>(new Set());
  readonly enabledKeywordCount = computed(() =>
    this.trendList().filter((item) => this.isKeywordEnabled(item)).length
  );

  // 分頁控制 Signals
  pageIndex = signal<number>(0);
  pageSize = signal<number>(10);
  readonly pageSizeOptions: number[] = [5, 10, 20, 50];

  filteredTrends = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.aiFilter();
    const enabledFilter = this.enabledFilter();
    let list = this.trendList();

    if (q) {
      list = list.filter((item) => (item.keyword ?? '').toLowerCase().includes(q));
    }

    if (filter === 'NORMAL') {
      list = list.filter((item) => !item.divergenceFlag);
    } else if (filter === 'WARN') {
      list = list.filter((item) => !!item.divergenceFlag);
    }

    if (enabledFilter === 'ENABLED') {
      list = list.filter((item) => this.isKeywordEnabled(item));
    } else if (enabledFilter === 'DISABLED') {
      list = list.filter((item) => !this.isKeywordEnabled(item));
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

  onEnabledFilterChange(filter: 'ALL' | 'ENABLED' | 'DISABLED'): void {
    this.enabledFilter.set(filter);
    this.pageIndex.set(0);
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.aiFilter.set('ALL');
    this.enabledFilter.set('ALL');
    this.pageIndex.set(0);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  loadTrends() {
    this.loadSubscription?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.loadSubscription = this.trendService.getTrends()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.trendList.set(res ?? []);
          this.isLoading.set(false);
          this.pageIndex.set(0);
        },
        error: (err) => {
          console.error('[TrendsComponent] 後端 API 請求失敗:', err);
          this.trendList.set([]);
          this.errorMessage.set('趨勢資料載入失敗，請稍後再試。');
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
    'stage',
    'aiSignal',
    'keywordEnabled'
  ];

  isKeywordEnabled(row: TrendSignalRow): boolean {
    return row.enabled !== false;
  }

  isKeywordPending(keywordId: number | undefined): boolean {
    return keywordId !== undefined && this.pendingKeywordIds().has(keywordId);
  }

  onKeywordToggle(event: MouseEvent, row: TrendSignalRow): void {
    event.stopPropagation();
    const keywordId = row.keywordId;
    if (!this.canManageKeywords() || keywordId === undefined || this.isKeywordPending(keywordId)) {
      return;
    }

    const enabled = !this.isKeywordEnabled(row);
    this.setKeywordPending(keywordId, true);
    const confirmation$ = enabled
      ? of(true)
      : this.keywordService.getTrendKeywordUsage({ id: keywordId }).pipe(
          switchMap((response) => {
            const products = response.data?.products ?? [];
            if (products.length === 0) return of(true);
            const names = products.map((product) => `「${product.name ?? `品項 #${product.id}`}」`).join('、');
            return this.dialogService.Confirm({
              title: '停用關鍵字',
              message: `關鍵字「${row.keyword ?? ''}」目前綁定以下品項：${names}。停用後將影響這些品項的每日熱度合成，確定要停用嗎？`,
              confirmText: '確認停用',
              cancelText: '取消',
              isDanger: true,
            });
          })
        );

    confirmation$.pipe(
      switchMap((confirmed) => confirmed
        ? this.keywordService.updateTrendKeywordEnabled({
            id: keywordId,
            trendKeywordEnabledUpdateRequest: { enabled },
          })
        : of(null)),
      finalize(() => this.setKeywordPending(keywordId, false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        if (response === null) return;
        const savedEnabled = response.data?.enabled ?? enabled;
        this.trendList.update((rows) => rows.map((item) =>
          item.keywordId === keywordId ? { ...item, enabled: savedEnabled } : item
        ));
      },
      error: () => this.errorMessage.set('關鍵字啟用狀態更新失敗，請稍後再試。'),
    });
  }

  private setKeywordPending(keywordId: number, pending: boolean): void {
    this.pendingKeywordIds.update((current) => {
      const next = new Set(current);
      pending ? next.add(keywordId) : next.delete(keywordId);
      return next;
    });
  }

  goToDetail(keywordId: number | string): void {
    const id = Number(keywordId);
    if (!Number.isInteger(id) || id <= 0) return;
    this.router.navigate(['/trends', id]);
  }

  onRowKeydown(event: KeyboardEvent, keywordId: number | string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.goToDetail(keywordId);
  }

  formatStage(stage: string | null | undefined): string {
    return ({ RISING: '上升期', PLATEAU: '高原期', DECLINING: '衰退期' } as Record<string, string>)[stage ?? ''] ?? '-';
  }

  formatSlope(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    const percentage = Math.round(value * 100);
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage}%`;
  }
}
