import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpContext } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  AITasksService,
  AiBudgetControllerService,
  AiTaskResponse,
  AiTaskSummaryResponse,
  AiTaskItemResponse,
  Snapshot,
  PoolSnapshot,
} from '../../api';
import { SKIP_LOADING } from '../../core/http/loading-interceptor';
import { DialogService } from '../../services/dialog-service';
import { CreateTaskDialogComponent, CreateTaskDialogResult } from './create-task-dialog/create-task-dialog.component';

@Component({
  selector: 'app-ai-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    MatSelectModule,
    MatFormFieldModule,
    MatPaginatorModule,
  ],
  templateUrl: './ai-tasks.component.html',
  styleUrl: './ai-tasks.component.scss',
})
export class AiTasksComponent implements OnInit, OnDestroy {
  private readonly aiTasksService = inject(AITasksService);
  private readonly aiBudgetService = inject(AiBudgetControllerService);
  private readonly dialogService = inject(DialogService);
  private readonly matDialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  // ── 狀態訊號 (Signals) ──
  readonly tasks = signal<AiTaskResponse[]>([]);
  readonly summary = signal<AiTaskSummaryResponse | null>(null);
  readonly budget = signal<Snapshot | null>(null);
  readonly totalCount = signal<number>(0);
  readonly pageIndex = signal<number>(0);
  readonly pageSize = signal<number>(10);
  readonly selectedStatus = signal<string>('ALL');

  readonly isLoading = signal<boolean>(false);
  readonly expandedTaskId = signal<number | null>(null);
  readonly taskItems = signal<Record<number, AiTaskItemResponse[]>>({});
  readonly loadingItemsTaskId = signal<number | null>(null);

  private pollTimer: any = null;

  // ── 計算訊號 (Computed) ──
  readonly activeRunningTask = computed(() => {
    const list = this.tasks();
    return list.find((t) => t.status === 'RUNNING') || list.find((t) => t.status === 'PENDING') || null;
  });

  readonly isAnyRunning = computed(() => {
    return (this.summary()?.runningCount ?? 0) > 0 || !!this.activeRunningTask();
  });

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ── 資料載入 (Data Fetching) ──
  reload(): void {
    this.isLoading.set(true);
    this.loadSummary();
    this.loadBudget();
    this.loadTasks(false);
  }

  private loadSummary(silent = false): void {
    const context = silent ? new HttpContext().set(SKIP_LOADING, true) : undefined;
    this.aiTasksService.summary1('body', false, { context }).subscribe({
      next: (res) => {
        if (res.data) {
          this.summary.set(res.data);
          this.checkPollingRequirement();
        }
      },
      error: (err) => console.error('Failed to load AI task summary:', err),
    });
  }

  private loadBudget(silent = false): void {
    const context = silent ? new HttpContext().set(SKIP_LOADING, true) : undefined;
    this.aiBudgetService.current('body', false, { context }).subscribe({
      next: (res) => {
        if (res.data) {
          this.budget.set(res.data);
        }
      },
      error: (err) => console.error('Failed to load budget snapshot:', err),
    });
  }

  loadTasks(silent = false): void {
    const context = silent ? new HttpContext().set(SKIP_LOADING, true) : undefined;
    const statusParam =
      this.selectedStatus() !== 'ALL'
        ? (this.selectedStatus() as AiTaskResponse.StatusEnum)
        : undefined;

    this.aiTasksService
      .list1(
        {
          status: statusParam,
          page: this.pageIndex(),
          size: this.pageSize(),
        },
        'body',
        false,
        { context }
      )
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          const pageData = res.data;
          this.tasks.set(pageData?.content ?? []);
          this.totalCount.set(pageData?.totalElements ?? 0);
          this.checkPollingRequirement();

          // 若當前展開的任務正在執行，靜默重整其子項目
          const openTaskId = this.expandedTaskId();
          if (openTaskId) {
            const currentExpanded = this.tasks().find((t) => t.taskId === openTaskId);
            if (currentExpanded && (currentExpanded.status === 'RUNNING' || currentExpanded.status === 'PENDING')) {
              this.fetchTaskItems(openTaskId, true);
            }
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          console.error('Failed to load AI tasks:', err);
        },
      });
  }

  // ── 輪詢機制 (Polling) ──
  private checkPollingRequirement(): void {
    const hasRunning =
      (this.summary()?.runningCount ?? 0) > 0 ||
      this.tasks().some((t) => t.status === 'RUNNING' || t.status === 'PENDING');

    if (hasRunning && !this.pollTimer) {
      this.startPolling();
    } else if (!hasRunning && this.pollTimer) {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      this.loadSummary(true);
      this.loadBudget(true);
      this.loadTasks(true);
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ── 分頁與篩選 (Paging & Filtering) ──
  onStatusFilterChange(status: string): void {
    this.selectedStatus.set(status);
    this.pageIndex.set(0);
    this.loadTasks(false);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadTasks(false);
  }

  // ── 子項目展開 (Expand Items) ──
  toggleTaskItems(taskId?: number): void {
    if (!taskId) return;
    if (this.expandedTaskId() === taskId) {
      this.expandedTaskId.set(null);
      return;
    }

    this.expandedTaskId.set(taskId);
    if (!this.taskItems()[taskId]) {
      this.fetchTaskItems(taskId, false);
    }
  }

  private fetchTaskItems(taskId: number, silent = false): void {
    if (!silent) {
      this.loadingItemsTaskId.set(taskId);
    }
    const context = silent ? new HttpContext().set(SKIP_LOADING, true) : undefined;
    this.aiTasksService.items({ taskId }, 'body', false, { context }).subscribe({
      next: (res) => {
        this.loadingItemsTaskId.set(null);
        if (res.data) {
          this.taskItems.update((prev) => ({
            ...prev,
            [taskId]: res.data ?? [],
          }));
        }
      },
      error: (err) => {
        this.loadingItemsTaskId.set(null);
        console.error(`Failed to load items for task #${taskId}:`, err);
      },
    });
  }

  // ── 建立任務 (Create Task) ──
  openCreateDialog(): void {
    const dialogRef = this.matDialog.open<CreateTaskDialogComponent, void, CreateTaskDialogResult | null>(
      CreateTaskDialogComponent,
      {
        width: '500px',
        maxWidth: '90vw',
        disableClose: true,
      }
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      this.aiTasksService
        .create2({
          createAiTaskRequest: {
            taskType: result.taskType,
            productIds: result.productIds,
            options: {
              forceRefresh: result.forceRefresh,
            },
          },
        })
        .subscribe({
          next: (res) => {
            const createdTask = res.data;
            this.snackBar.open(
              `已成功建立 AI 任務 #${createdTask?.taskId} (${createdTask?.taskTypeDisplayName || createdTask?.taskType})`,
              '關閉',
              { duration: 4000 }
            );
            this.reload();
            this.startPolling();
          },
          error: (err) => {
            const errorMsg = err?.error?.message || '建立任務失敗，請稍後再試';
            this.snackBar.open(`建立失敗：${errorMsg}`, '關閉', { duration: 5000 });
          },
        });
    });
  }

  // ── 取消任務 (Cancel Task) ──
  cancelTask(task: AiTaskResponse): void {
    if (!task.taskId) return;
    this.dialogService
      .Confirm({
        title: '確認取消 AI 任務',
        message: `確定要取消任務 #${task.taskId} (${task.taskTypeDisplayName || task.taskType}) 嗎？未完成的品項將立即中斷。`,
        confirmText: '確認取消',
        cancelText: '返回',
        isDanger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.aiTasksService.cancel({ taskId: task.taskId! }).subscribe({
          next: () => {
            this.snackBar.open(`已成功取消任務 #${task.taskId}`, '關閉', { duration: 3000 });
            this.reload();
          },
          error: (err) => {
            const errorMsg = err?.error?.message || '取消任務失敗';
            this.snackBar.open(`取消失敗：${errorMsg}`, '關閉', { duration: 4000 });
          },
        });
      });
  }

  // ── 重跑失敗品項 (Retry Failed Items) ──
  retryFailed(task: AiTaskResponse): void {
    if (!task.taskId) return;
    this.dialogService
      .Confirm({
        title: '重跑失敗品項',
        message: `確定要將任務 #${task.taskId} 的 ${task.failCount} 個失敗品項建立為新重試任務嗎？系統將由 RETRY 預算池執行。`,
        confirmText: '確認重跑',
        cancelText: '取消',
        isDanger: false,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.aiTasksService.retryFailed({ taskId: task.taskId! }).subscribe({
          next: (res) => {
            const newTaskId = res.data?.taskId;
            this.snackBar.open(`已建立重試任務 #${newTaskId}，開始重新排程處理`, '關閉', { duration: 4000 });
            this.reload();
            this.startPolling();
          },
          error: (err) => {
            const errorMsg = err?.error?.message || '重跑失敗項失敗';
            this.snackBar.open(`重跑失敗：${errorMsg}`, '關閉', { duration: 4000 });
          },
        });
      });
  }

  // ── 輔助格式化 (Helpers) ──
  getPool(poolName: PoolSnapshot.PoolEnum): PoolSnapshot | undefined {
    return this.budget()?.pools?.find((p) => p.pool === poolName);
  }

  getPoolPercent(poolName: PoolSnapshot.PoolEnum): number {
    const pool = this.getPool(poolName);
    if (!pool || !pool.limit || pool.limit <= 0) return 0;
    const pct = Math.round(((pool.used ?? 0) / pool.limit) * 100);
    return Math.min(100, Math.max(0, pct));
  }

  calculateDuration(startedAt?: string, finishedAt?: string): string {
    if (!startedAt) return '-';
    const start = new Date(startedAt).getTime();
    if (isNaN(start)) return '-';
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const diffSec = Math.max(0, Math.floor((end - start) / 1000));
    if (diffSec < 60) return `${diffSec} 秒`;
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    return `${min} 分 ${sec} 秒`;
  }

  formatBudgetPool(pool?: string): string {
    switch (pool) {
      case 'TRACK_A':
        return 'A 軌批次 (70%)';
      case 'TRACK_B':
        return 'B 軌探索 (20%)';
      case 'RETRY':
        return '重試校準 (10%)';
      default:
        return pool || '-';
    }
  }

  formatTaskStatus(status?: string): string {
    switch (status) {
      case 'RUNNING':
        return '執行中';
      case 'PENDING':
        return '排隊中';
      case 'SUCCEEDED':
        return '已完成';
      case 'FAILED':
        return '失敗';
      case 'PARTIAL':
        return '部分成功';
      case 'CANCELLED':
        return '已取消';
      default:
        return status || '-';
    }
  }

  formatItemStatus(status?: string): string {
    switch (status) {
      case 'SUCCEEDED':
        return '成功';
      case 'FAILED':
        return '失敗';
      case 'SKIPPED_CACHE':
        return '快取命中跳過';
      case 'SKIPPED_QUOTA':
        return '配額超限跳過';
      case 'PENDING':
        return '處理中';
      default:
        return status || '-';
    }
  }

  canCancel(task: AiTaskResponse): boolean {
    return task.status === 'PENDING' || task.status === 'RUNNING';
  }

  canRetryFailed(task: AiTaskResponse): boolean {
    return (task.failCount ?? 0) > 0 && (task.status === 'FAILED' || task.status === 'PARTIAL');
  }
}
