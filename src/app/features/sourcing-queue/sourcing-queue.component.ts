import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { ProductControllerService, SourcingScoutControllerService } from '../../api';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface SourcingQueueItem {
  productId: number;
  keyword: string;
  heatStage?: 'RISING' | 'PLATEAU' | 'DECLINING' | null;
  stageWeeks?: number | null;
  estimatedLifespanDays?: number | null;
  leadTimeDays?: number | null;
  timeGapDays?: number | null;
  sourcingStatus: 'PENDING' | 'SOURCING' | 'URGENT' | 'PROMOTED' | 'REJECTED';
}

@Component({
  selector: 'app-sourcing-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
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

  goToSourcing() {
    console.log('🚀 [SourcingQueueComponent] 點擊「+ 新增探索」按鈕，嘗試跳轉至 /sourcing');
    this.router.navigate(['/sourcing']).then((success) => {
      if (success) {
        console.log('✅ [SourcingQueueComponent] 跳轉 /sourcing 成功');
      } else {
        console.warn('⚠️ [SourcingQueueComponent] 跳轉 /sourcing 失敗！請檢查路由守衛 (roleGuard/authGuard)。');
      }
    }).catch((err) => {
      console.error('❌ [SourcingQueueComponent] 跳轉 /sourcing 發生異常：', err);
    });
  }

  items = signal<SourcingQueueItem[]>([]);
  selectedStatus = signal<string>('ALL');

  // 計算頂部統計數據
  activeCount = computed(() => {
    return this.items().filter((i) =>
      ['SOURCING', 'URGENT', 'PENDING'].includes(i.sourcingStatus)
    ).length;
  });

  rejectedCount = computed(() => {
    return this.items().filter((i) => i.sourcingStatus === 'REJECTED').length;
  });

  promotedCount = computed(() => {
    return this.items().filter((i) => i.sourcingStatus === 'PROMOTED').length;
  });

  // 篩選與排序後的清單（未淘汰依時效落差升冪，已淘汰置底）
  filteredItems = computed(() => {
    const list = this.items();
    const filter = this.selectedStatus();

    let filtered = list;
    if (filter === 'ACTIVE') {
      filtered = list.filter((i) =>
        ['SOURCING', 'URGENT', 'PENDING'].includes(i.sourcingStatus)
      );
    } else if (filter !== 'ALL') {
      filtered = list.filter((i) => i.sourcingStatus === filter);
    }

    return [...filtered].sort((a, b) => {
      const aRejected = a.sourcingStatus === 'REJECTED';
      const bRejected = b.sourcingStatus === 'REJECTED';
      if (aRejected !== bRejected) return aRejected ? 1 : -1;

      if (a.timeGapDays == null && b.timeGapDays == null) return 0;
      if (a.timeGapDays == null) return 1;
      if (b.timeGapDays == null) return -1;
      return a.timeGapDays - b.timeGapDays;
    });
  });

  ngOnInit() {
    this.loadQueue();
  }

  async unpack(raw: any): Promise<any> {
    if (raw instanceof Blob) {
      const text = await raw.text();
      return JSON.parse(text);
    }
    return raw;
  }

  async loadQueue() {
    try {
      const res = await firstValueFrom(
        this.productService.search({ trackType: 'B', size: 100 })
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
        // 方案 1：只有已有評估數據（例如 timeGapDays 不為 null）的商品才向後端請求探索報告，
        // 尚未探詢過的商品直接跳過，避免在瀏覽器控制台引發 404
        if (p.timeGapDays != null) {
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
            // ignore
          }
        }

        const estimatedLifespan = reportData?.estimatedLifespanDays ?? null;
        const timeGap = reportData?.timeGapDays ?? p.timeGapDays ?? null;
        let leadTime: number | null = null;
        if (estimatedLifespan != null && timeGap != null) {
          leadTime = estimatedLifespan - timeGap;
        }

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
      console.error('取得尋源佇列失敗', err);
    }
  }

  getDisplayIndex(item: SourcingQueueItem, index: number): string {
    if (item.sourcingStatus === 'REJECTED') {
      return '—';
    }
    const num = index + 1;
    return num < 10 ? `0${num}` : `${num}`;
  }

  getHeatStageLabel(item: SourcingQueueItem): string {
    if (!item.heatStage) return '—';
    if (item.heatStage === 'PLATEAU') {
      return item.stageWeeks ? `高原期 W${item.stageWeeks}` : '高原期';
    }
    if (item.heatStage === 'RISING') return '上升期';
    if (item.heatStage === 'DECLINING') return '衰退期';
    return item.heatStage;
  }

  getStatusLabel(status?: string | null): string {
    if (!status) return '—';
    switch (status) {
      case 'URGENT':
        return '需加速';
      case 'PROMOTED':
        return '已成案';
      case 'SOURCING':
        return '尋源中';
      case 'PENDING':
        return '待評估';
      case 'REJECTED':
        return '已淘汰';
      default:
        return status;
    }
  }

  getStatusClass(status?: string | null): string {
    if (!status) return '';
    switch (status) {
      case 'URGENT':
        return 'badge-urgent';
      case 'PROMOTED':
        return 'badge-promoted';
      case 'SOURCING':
        return 'badge-sourcing';
      case 'PENDING':
        return 'badge-pending';
      case 'REJECTED':
        return 'badge-rejected';
      default:
        return '';
    }
  }

  getHeatBadgeClass(stage?: string | null): string {
    if (!stage) return '';
    if (stage === 'PLATEAU') return 'heat-plateau';
    if (stage === 'RISING') return 'heat-rising';
    if (stage === 'DECLINING') return 'heat-declining';
    return '';
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
