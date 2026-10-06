import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpContext } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginatorIntl } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { SourcingScoutControllerService } from '../../api';
import { firstValueFrom } from 'rxjs';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import { SourcingQueueFilter, SourcingQueueService } from './sourcing-queue.service';

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
  private readonly queueService = inject(SourcingQueueService);
  private readonly sourcingService = inject(SourcingScoutControllerService);

  readonly displayedColumns: string[] = [
    'index',
    'keyword',
    'heatStage',
    'lifespan',
    'leadTime',
    'timeGap',
    'status',
    'action',
  ];

  // 狀態訊號 (Signals)
  items = signal<SourcingQueueItem[]>([]);
  selectedStatus = signal<SourcingQueueFilter>('ALL');
  loadError = signal<string | null>(null);
  actionError = signal<string | null>(null);
  pendingProductId = signal<number | null>(null);
  totalElements = signal<number>(0);
  activeCount = signal<number>(0);
  rejectedCount = signal<number>(0);
  promotedCount = signal<number>(0);

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

  ngOnInit() {
    this.loadQueue();
  }

  onPageChange(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    void this.loadQueue();
  }

  onStatusChange(val: SourcingQueueFilter) {
    this.selectedStatus.set(val);
    this.pageIndex.set(0);
    void this.loadQueue();
  }

  async unpack(raw: any): Promise<any> {
    if (raw instanceof Blob) {
      const text = await raw.text();
      return JSON.parse(text);
    }
    return raw;
  }

  async loadQueue(skipGlobalLoading = false) {
    this.loadError.set(null);
    try {
      const pageRequest = skipGlobalLoading
        ? this.queueService.getQueue(
            this.selectedStatus(),
            this.pageIndex(),
            this.pageSize(),
            true,
          )
        : this.queueService.getQueue(
            this.selectedStatus(),
            this.pageIndex(),
            this.pageSize(),
          );
      const page = await firstValueFrom(pageRequest);
      this.items.set(page.content);
      this.totalElements.set(page.totalElements);
      this.activeCount.set(page.summary.activeCount);
      this.rejectedCount.set(page.summary.rejectedCount);
      this.promotedCount.set(page.summary.promotedCount);
    } catch (err) {
      console.warn('⚠️ [SourcingQueue] 取得尋源佇列 API 失敗:', err);
      this.items.set([]);
      this.totalElements.set(0);
      this.loadError.set('尋源優先序載入失敗，請稍後重新整理。');
    }
  }

  isPending(item: SourcingQueueItem): boolean {
    return ['PENDING', 'EVALUATING'].includes(item.sourcingStatus);
  }

  canSaveAsWatching(item: SourcingQueueItem): boolean {
    return ['URGENT', 'EXPEDITE', 'SOURCING', 'REJECTED', 'ELIMINATED'].includes(item.sourcingStatus)
      && this.pendingProductId() !== item.productId;
  }

  canAddToSourcingQueue(item: SourcingQueueItem): boolean {
    return this.isPending(item)
      && item.timeGapDays != null
      && item.timeGapDays >= 0
      && this.pendingProductId() !== item.productId;
  }

  getPrioritizeDisabledReason(item: SourcingQueueItem): string {
    if (this.pendingProductId() === item.productId) return '操作處理中，請稍候。';
    if (item.timeGapDays == null) return '目前無法顯示時效落差，不可加入尋源優先序。';
    if (item.timeGapDays < 0) return '時效落差小於 0，不可加入尋源優先序。';
    return '';
  }

  async saveAsWatching(item: SourcingQueueItem): Promise<void> {
    if (!this.canSaveAsWatching(item)) return;
    await this.runAction(
      item,
      firstValueFrom(this.sourcingService.watch(
        { productId: item.productId },
        'body',
        false,
        { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) },
      )),
      '存為觀察失敗，請稍後再試。',
    );
  }

  async addToSourcingQueue(item: SourcingQueueItem): Promise<void> {
    if (!this.canAddToSourcingQueue(item)) return;
    await this.runAction(
      item,
      firstValueFrom(this.sourcingService.prioritize(
        { productId: item.productId },
        'body',
        false,
        { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) },
      )),
      '加入尋源優先序失敗，請稍後再試。',
    );
  }

  private async runAction(
    item: SourcingQueueItem,
    request: Promise<unknown>,
    fallbackMessage: string,
  ): Promise<void> {
    this.pendingProductId.set(item.productId);
    this.actionError.set(null);
    try {
      await request;
      this.queueService.invalidateCache();
      await this.loadQueue(true);
    } catch (error: any) {
      const body = error?.error instanceof Blob
        ? await this.unpack(error.error).catch(() => null)
        : error?.error;
      this.actionError.set(body?.error?.message ?? body?.message ?? fallbackMessage);
    } finally {
      this.pendingProductId.set(null);
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
