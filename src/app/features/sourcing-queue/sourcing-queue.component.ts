import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProductControllerService, SourcingScoutControllerService } from '../../api';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface SourcingQueueItem {
  productId: number;
  keyword: string;
  heatStage?: 'RISING' | 'PLATEAU' | 'DECLINING' | string | null;
  stageWeeks?: number | null;
  estimatedLifespanDays?: number | null;
  leadTimeDays?: number | null;
  timeGapDays?: number | null;
  sourcingStatus: 'PENDING' | 'SOURCING' | 'URGENT' | 'PROMOTED' | 'REJECTED' | 'EVALUATING' | 'EXPEDITE' | 'CONVERTED' | 'ELIMINATED' | string;
}

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
  selector: 'app-sourcing-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  providers: [
    { provide: MatPaginatorIntl, useFactory: getZhPaginatorIntl }
  ],
  templateUrl: './sourcing-queue.component.html',
  styleUrl: './sourcing-queue.component.scss',
})
export class SourcingQueueComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly productService = inject(ProductControllerService);
  private readonly sourcingService = inject(SourcingScoutControllerService);

  readonly displayedColumns: string[] = [
    'index',
    'keyword',
    'heatStage',
    'lifespan',
    'leadTime',
    'timeGap',
    'status',
  ];

  // 狀態訊號 (Signals)
  items = signal<SourcingQueueItem[]>([]);
  selectedStatus = signal<string>('ALL');
  loadError = signal<string | null>(null);

  // 分頁控制 Signals
  pageIndex = signal<number>(0);
  pageSize = signal<number>(10);
  readonly pageSizeOptions: number[] = [5, 10, 20, 50];

  goToSourcing() {
    console.log('🚀 [SourcingQueueComponent] 點擊「+ 新增探索」按鈕，跳轉至 /sourcing');
    this.router.navigate(['/sourcing']).catch((err) => {
      console.error('❌ [SourcingQueueComponent] 跳轉 /sourcing 發生異常：', err);
    });
  }

  // 頂部統計指標
  activeCount = computed(() => {
    return this.items().filter((i) =>
      ['SOURCING', 'URGENT', 'EXPEDITE', 'PENDING', 'EVALUATING'].includes(i.sourcingStatus)
    ).length;
  });

  rejectedCount = computed(() => {
    return this.items().filter((i) => ['REJECTED', 'ELIMINATED'].includes(i.sourcingStatus)).length;
  });

  promotedCount = computed(() => {
    return this.items().filter((i) => ['PROMOTED', 'CONVERTED'].includes(i.sourcingStatus)).length;
  });

  // 篩選與排序後的總清單（未淘汰依時效落差升冪，已淘汰置底）
  filteredItems = computed(() => {
    const list = this.items();
    const filter = this.selectedStatus();

    let filtered = list;
    if (filter === 'ACTIVE') {
      filtered = list.filter((i) =>
        ['SOURCING', 'URGENT', 'EXPEDITE', 'PENDING', 'EVALUATING'].includes(i.sourcingStatus)
      );
    } else if (filter === 'URGENT') {
      filtered = list.filter((i) => ['URGENT', 'EXPEDITE'].includes(i.sourcingStatus));
    } else if (filter === 'PENDING') {
      filtered = list.filter((i) => ['PENDING', 'EVALUATING'].includes(i.sourcingStatus));
    } else if (filter === 'PROMOTED') {
      filtered = list.filter((i) => ['PROMOTED', 'CONVERTED'].includes(i.sourcingStatus));
    } else if (filter === 'REJECTED') {
      filtered = list.filter((i) => ['REJECTED', 'ELIMINATED'].includes(i.sourcingStatus));
    } else if (filter !== 'ALL') {
      filtered = list.filter((i) => i.sourcingStatus === filter);
    }

    return [...filtered].sort((a, b) => {
      const aRejected = a.sourcingStatus === 'REJECTED' || a.sourcingStatus === 'ELIMINATED';
      const bRejected = b.sourcingStatus === 'REJECTED' || b.sourcingStatus === 'ELIMINATED';
      if (aRejected !== bRejected) return aRejected ? 1 : -1;

      if (a.timeGapDays == null && b.timeGapDays == null) return 0;
      if (a.timeGapDays == null) return 1;
      if (b.timeGapDays == null) return -1;
      return a.timeGapDays - b.timeGapDays;
    });
  });

  // 分頁後當前頁顯示項目
  paginatedItems = computed(() => {
    const list = this.filteredItems();
    const size = this.pageSize();
    const maxPage = Math.max(0, Math.ceil(list.length / size) - 1);
    const current = Math.min(this.pageIndex(), maxPage);
    const start = current * size;
    return list.slice(start, start + size);
  });

  ngOnInit() {
    this.loadQueue();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onStatusChange(val: string) {
    this.selectedStatus.set(val);
    this.pageIndex.set(0);
  }

  async unpack(raw: any): Promise<any> {
    if (raw instanceof Blob) {
      const text = await raw.text();
      return JSON.parse(text);
    }
    return raw;
  }

  async loadQueue() {
    this.loadError.set(null);
    try {
      const res = await firstValueFrom(
        this.productService.search({ trackType: 'B', size: 100 } as any)
      );
      const responseData = await this.unpack(res);
      const products =
        responseData?.data?.content ?? responseData?.content ?? [];

      if (products.length === 0) {
        this.items.set([]);
        return;
      }

      const queueItems: SourcingQueueItem[] = [];
      for (const p of products) {
        let reportData: any = null;
        try {
          const rawReport = await firstValueFrom(
            this.sourcingService
              .latest1({ productId: p.id })
              .pipe(catchError(() => of(null)))
          );
          if (rawReport) {
            const report = await this.unpack(rawReport);
            reportData = report?.data ?? report;
          }
        } catch {
          // Individual missing reports retain the real product row with empty snapshot values.
        }

        const estimatedLifespan = reportData?.estimatedLifespanDays ?? null;
        const leadTime = reportData?.leadTimeDays ?? null;
        const timeGap = reportData?.timeGapDays ?? null;

        queueItems.push({
          productId: p.id,
          keyword: p.name,
          heatStage: reportData?.heatStage ?? null,
          stageWeeks: reportData?.stageWeeks ?? null,
          estimatedLifespanDays: estimatedLifespan,
          leadTimeDays: leadTime,
          timeGapDays: timeGap,
          sourcingStatus: p.sourcingStatus ?? 'PENDING',
        });
      }

      this.items.set(queueItems);
    } catch (err) {
      console.warn('⚠️ [SourcingQueue] 取得尋源佇列 API 失敗:', err);
      this.items.set([]);
      this.loadError.set('尋源優先序載入失敗，請稍後重新整理。');
    }
  }

  getDisplayIndex(item: SourcingQueueItem, index: number): string {
    if (item.sourcingStatus === 'REJECTED' || item.sourcingStatus === 'ELIMINATED') {
      return '—';
    }
    const realIndex = this.pageIndex() * this.pageSize() + index + 1;
    return realIndex < 10 ? `0${realIndex}` : `${realIndex}`;
  }

  getHeatStageLabel(item: SourcingQueueItem): string {
    if (!item.heatStage) return '—';
    if (item.heatStage === 'PLATEAU' || item.heatStage === 'PEAK') {
      return item.stageWeeks ? `高原期 W${item.stageWeeks}` : '高原期';
    }
    if (item.heatStage === 'RISING' || item.heatStage === 'GROWING' || item.heatStage === 'EMERGING') {
      return item.stageWeeks ? `上升期 W${item.stageWeeks}` : '上升期';
    }
    if (item.heatStage === 'DECLINING') {
      return item.stageWeeks ? `衰退期 W${item.stageWeeks}` : '衰退期';
    }
    return item.heatStage;
  }

  getHeatBadgeClass(stage?: string | null): string {
    if (!stage) return '';
    if (stage === 'PLATEAU' || stage === 'PEAK') return 'stage-plateau';
    if (stage === 'RISING' || stage === 'GROWING' || stage === 'EMERGING') return 'stage-rising';
    if (stage === 'DECLINING') return 'stage-declining';
    return '';
  }

  getStatusLabel(status?: string | null): string {
    if (!status) return '—';
    switch (status) {
      case 'URGENT':
      case 'EXPEDITE':
        return '需加速';
      case 'PROMOTED':
      case 'CONVERTED':
        return '已成案';
      case 'SOURCING':
        return '尋源中';
      case 'PENDING':
      case 'EVALUATING':
        return '待評估';
      case 'REJECTED':
      case 'ELIMINATED':
        return '已淘汰';
      default:
        return status;
    }
  }

  getStatusBadgeClass(status?: string | null): string {
    if (!status) return '';
    switch (status) {
      case 'URGENT':
      case 'EXPEDITE':
        return 'status-quota';
      case 'PROMOTED':
      case 'CONVERTED':
      case 'SOURCING':
        return 'status-normal';
      case 'PENDING':
      case 'EVALUATING':
        return 'status-secondary';
      case 'REJECTED':
      case 'ELIMINATED':
        return 'status-warn';
      default:
        return 'status-secondary';
    }
  }

  getTimeGapClass(gap?: number | null): string {
    if (gap == null) return '';
    if (gap < 0) return 'gap-negative';
    if (gap <= 14) return 'gap-urgent';
    return 'gap-positive';
  }

  formatTimeGap(gap?: number | null): string {
    if (gap == null) return '—';
    return gap > 0 ? `+${gap} 天` : `${gap} 天`;
  }
}
