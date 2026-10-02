import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  AITasksService,
  AiBudgetControllerService,
  ProductReferenceControllerService,
  CategoryTreeResponse,
  SourcingScoutControllerService,
  SourcingScoutResponse
} from '../../api';
import { inject } from '@angular/core';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../services/dialog-service';
import { SKIP_LOADING } from '../../core/http/loading-interceptor';
import { HttpContext } from '@angular/common/http';
import { RouterLink, Router } from '@angular/router';
@Component({
  selector: 'app-sourcing',
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule, CommonModule, RouterLink],
  templateUrl: './sourcing.component.html',
  styleUrl: './sourcing.component.scss'
})
export class SourcingComponent implements OnInit, OnDestroy {
  private readonly STORAGE_KEY = 'sourcing_active_task';
  private pollTimer: any = null;
  private readonly router = inject(Router);
  private readonly categoryService = inject(ProductReferenceControllerService);
  private sourcingService = inject(SourcingScoutControllerService);
  private aiTasksService = inject(AITasksService);
  private aiBudgetService = inject(AiBudgetControllerService);
  private readonly dialogService = inject(DialogService);

  // ── 狀態訊號 (Signals) ──
  public isScouting = signal<boolean>(false);
  public executionSeconds = signal<number>(0);
  private scoutStartTime = 0;
  public categories = signal<CategoryTreeResponse[]>([]);
  public selectedCategoryId = signal<number | null>(null);
  public keyword = signal<string>('');
  public scoutReport = signal<any | null>(null);
  public scoutError = signal<string | null>(null);
  public frequency = signal<string>('0/100');
  public isQuotaExhausted = signal<boolean>(false);
  public isActionPending = signal<boolean>(false);

  goToQueue() {
    console.log('🚀 [SourcingComponent] 點擊「尋源優先序」，正在跳轉至 /sourcing-queue ...');
    this.router.navigate(['/sourcing-queue']).then((success) => {
      if (success) {
        console.log('✅ [SourcingComponent] 跳轉 /sourcing-queue 成功');
      } else {
        console.warn('⚠️ [SourcingComponent] 跳轉 /sourcing-queue 失敗！請檢查是否被路由守衛 (roleGuard/authGuard) 攔截。');
      }
    }).catch((err) => {
      console.error('❌ [SourcingComponent] 跳轉 /sourcing-queue 發生異常：', err);
    });
  }

  ngOnDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  private static readonly MOCK_CATEGORIES: CategoryTreeResponse[] = [
    {
      id: 1,
      name: '休閒零食',
      children: [
        { id: 11, name: '洋芋片 / 脆片' },
        { id: 12, name: '巧克力 / 夾心餅' },
        { id: 13, name: '肉乾 / 肉條' }
      ]
    },
    {
      id: 2,
      name: '沖泡飲品',
      children: [
        { id: 21, name: '濾掛 / 冷萃咖啡' },
        { id: 22, name: '高山烏龍 / 原片茶' },
        { id: 23, name: '燕麥奶 / 穀物沖飲' }
      ]
    },
    {
      id: 3,
      name: '生鮮烘焙',
      children: [
        { id: 31, name: '生乳酪 / 蛋糕甜點' },
        { id: 32, name: '厚蛋捲 / 手工酥餅' }
      ]
    }
  ];

  ngOnInit() {
    this.fetchBudget();
    this.restoreActiveTask();
    this.categoryService.getCategories().subscribe({
      next: async (res) => {
        const responseData = await this.unpack(res);
        const data = responseData?.data ?? [];
        this.categories.set(data.length > 0 ? data : SourcingComponent.MOCK_CATEGORIES);
        console.log('品類取得成功', responseData?.data);
      },
      error: (err) => {
        console.warn('品類取得失敗，使用 Mock 預設品類回退:', err);
        this.categories.set(SourcingComponent.MOCK_CATEGORIES);
      }
    });
  }

  private restoreActiveTask() {
    const saved = sessionStorage.getItem(this.STORAGE_KEY);
    if (!saved) return;

    try {
      const taskInfo = JSON.parse(saved);
      if (taskInfo?.taskId) {
        if (taskInfo.keyword) this.keyword.set(taskInfo.keyword);
        if (taskInfo.categoryId) this.selectedCategoryId.set(taskInfo.categoryId);
        if (taskInfo.startTime) this.scoutStartTime = taskInfo.startTime;
        this.isScouting.set(true);
        console.log('🔄 偵測到進行中的尋源任務，正在恢復輪詢：', taskInfo);
        this.pollAiTask(taskInfo.taskId, taskInfo.productId);
      }
    } catch (e) {
      console.error('解析暫存任務失敗', e);
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  fetchBudget() {
    this.aiBudgetService.current().subscribe({
      next: async (res) => {
        const responseData = await this.unpack(res);
        const pools = responseData?.data?.pools ?? responseData?.pools ?? [];
        const trackBPool = pools.find((p: any) => p.pool === 'TRACK_B');
        if (trackBPool) {
          const used = trackBPool.used ?? 0;
          const limit = 100;
          this.frequency.set(`${used}/${limit}`);
          this.isQuotaExhausted.set(used >= limit || trackBPool.status === 'EXHAUSTED');
        }
      },
      error: (err) => {
        console.error('取得 AI 預算失敗', err);
      }
    });
  }

  startScout() {
    const keyword = this.keyword().trim();
    const categoryId = this.selectedCategoryId();
    console.log('準備開始探索，輸入參數：', { keyword, categoryId });
    if (!keyword || !categoryId) {
      this.dialogService.Confirm({
        title: '提示訊息',
        message: '請輸入關鍵字並選擇品類後再開始探索！',
        confirmText: '我知道了',
        cancelText: '',
        isDanger: false
      });
      return;
    }

    this.scoutReport.set(null);
    this.scoutError.set(null);
    this.isActionPending.set(false);
    this.isScouting.set(true);
    this.scoutStartTime = Date.now();

    this.sourcingService.scout({
      sourcingScoutRequest: {
        keyword: keyword,
        categoryId: categoryId,
        forceRefresh: false,
      }
    }).subscribe({
      next: async (res) => {
        const responseData = await this.unpack(res);
        console.log('探索發起成功，回應資料：', responseData);
        const taskId = responseData?.data?.taskId ?? responseData?.taskId ?? responseData?.data?.id;
        const productId = responseData?.data?.productId ?? responseData?.productId;

        if (!taskId) {
          this.isScouting.set(false);
          this.scoutError.set('查詢失敗：伺服器未回傳探索任務編號。');
          this.dialogService.Confirm({
            title: '查詢失敗',
            message: '伺服器未回傳探索任務編號，請稍後再試！',
            confirmText: '確定',
            isDanger: true
          });
          return;
        }

        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify({
          taskId,
          productId,
          keyword,
          categoryId,
          startTime: this.scoutStartTime
        }));

        this.pollAiTask(taskId, productId);
      },
      error: (err) => {
        console.error('發起探索 API 請求失敗:', err);
        this.isScouting.set(false);
        this.scoutReport.set(null);
        this.scoutError.set('查詢失敗：無法發起尋源探索，伺服器連線異常或尚未提供此服務。');
        this.dialogService.Confirm({
          title: '查詢失敗',
          message: '發起 AI 尋源探索失敗，伺服器連線異常或尚未支援此服務，請稍後再試！',
          confirmText: '確定',
          isDanger: true
        });
      }
    });
  }

  private pollAiTask(taskId: number, productId?: number) {
    if (!taskId) return;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(() => {
      this.aiTasksService.get2({ taskId },
        'body',
        false,
        { context: new HttpContext().set(SKIP_LOADING, true) }
      ).subscribe({
        next: async (res: any) => {
          const responseData = await this.unpack(res);
          const task = responseData?.data ?? responseData;
          console.log('輪詢進度：', task);

          if (task?.status === 'SUCCEEDED' || task?.status === 'COMPLETED') {
            if (this.pollTimer) {
              clearInterval(this.pollTimer);
            }
            sessionStorage.removeItem(this.STORAGE_KEY);

            if (productId) {
              this.fetchReport(productId);
            } else {
              // 若 response 沒帶 productId，從任務品項 (items) 取得
              this.aiTasksService.items({ taskId }).subscribe({
                next: async (itemsRes: any) => {
                  const itemsData = await this.unpack(itemsRes);
                  const items = itemsData?.data ?? itemsData ?? [];
                  const itemId = items?.[0]?.itemId;
                  const pId = items?.[0]?.productId;
                  if (itemId) {
                    this.fetchScoutResult(itemId);
                  } else if (pId) {
                    this.fetchReport(pId);
                  } else {
                    console.error('無法在任務項目中找到 productId', itemsData);
                    this.isScouting.set(false);
                    this.scoutError.set('查詢失敗：無法在任務項目中找到關聯商品。');
                    this.dialogService.Confirm({
                      title: '查詢失敗',
                      message: '無法在任務項目中找到關聯商品，請稍後再試！',
                      confirmText: '確定',
                      isDanger: true
                    });
                  }
                },
                error: (err: any) => {
                  console.error('查詢任務品項失敗', err);
                  this.isScouting.set(false);
                  this.scoutError.set('查詢失敗：無法查詢任務品項。');
                  this.dialogService.Confirm({
                    title: '查詢失敗',
                    message: '查詢任務品項失敗，請稍後再試！',
                    confirmText: '確定',
                    isDanger: true
                  });
                }
              });
            }

          } else if (task?.status === 'FAILED') {
            this.isScouting.set(false);
            if (this.pollTimer) {
              clearInterval(this.pollTimer);
            }
            sessionStorage.removeItem(this.STORAGE_KEY);
            this.scoutError.set('查詢失敗：AI 尋源探索任務執行失敗。');
            this.dialogService.Confirm({
              title: '查詢失敗',
              message: 'AI 尋源探索失敗，請稍後再試！',
              confirmText: '確定',
              isDanger: true
            });
          }
        },
        error: (err: any) => {
          console.error('查詢進度失敗', err);
          this.isScouting.set(false);
          if (this.pollTimer) {
            clearInterval(this.pollTimer);
          }
          sessionStorage.removeItem(this.STORAGE_KEY);
          this.scoutError.set('查詢失敗：無法查詢探索任務進度。');
          this.dialogService.Confirm({
            title: '查詢失敗',
            message: '查詢探索任務進度失敗，請稍後再試！',
            confirmText: '確定',
            isDanger: true
          });
        }
      });
    }, 5000);
  }

  private fetchReport(productId: number) {
    this.sourcingService.latest1({ productId }).subscribe({
      next: async (res) => {
        const responseData = await this.unpack(res);
        this.scoutReport.set(responseData?.data ?? responseData);
        const elapsed = Math.max(1, Math.round((Date.now() - this.scoutStartTime) / 1000));
        this.executionSeconds.set(elapsed);
        this.fetchBudget(); // 更新最新使用次數
        this.isScouting.set(false);
        console.log('尋源報告取得成功', responseData);
      },
      error: (err) => {
        console.error('取得尋源報告失敗', err);
        this.isScouting.set(false);
        this.scoutError.set('查詢失敗：無法取得 AI 尋源分析報告。');
        this.dialogService.Confirm({
          title: '查詢失敗',
          message: '無法取得 AI 尋源分析報告，請稍後再試！',
          confirmText: '確定',
          isDanger: true
        });
      }
    });
  }

  private fetchScoutResult(itemId: number) {
    this.sourcingService.latestResult({ itemId }).subscribe({
      next: async (res: any) => {
        const responseData = await this.unpack(res);
        this.scoutReport.set(responseData?.data ?? responseData);
        const elapsed = Math.max(1, Math.round((Date.now() - this.scoutStartTime) / 1000));
        this.executionSeconds.set(elapsed);
        this.fetchBudget();
        this.isScouting.set(false);
      },
      error: (err: any) => {
        console.error('取得尋源探索結果失敗', err);
        this.isScouting.set(false);
        this.scoutError.set('查詢失敗：無法取得 AI 尋源分析報告。');
      }
    });
  }

  /** 通用 Blob 與 JSON 解包輔助函數 */
  private async unpack(res: any): Promise<any> {
    if (res instanceof Blob) {
      try {
        const text = await res.text();
        return JSON.parse(text);
      } catch (e) {
        console.error('解析 Blob 失敗:', e);
        return null;
      }
    }
    return res;
  }

  getHeatStageText(stage?: string): string {
    const map: Record<string, string> = {
      PEAK: '高原期',
      PLATEAU: '高原期',
      GROWING: '成長期',
      RISING: '上升期',
      STABLE: '穩定期',
      DECLINING: '衰退期',
      EMERGING: '萌芽期'
    };
    return stage ? (map[stage] || stage) : '評估中';
  }

  getHeatStageBadgeClass(stage?: string): string {
    switch (stage) {
      case 'PEAK':
      case 'PLATEAU':
      case 'GROWING':
      case 'RISING':
        return 'status-normal';
      case 'DECLINING':
        return 'status-warn';
      default:
        return 'status-quota';
    }
  }

  /** 計算前置期天數（壽命 - 落差） */
  getLeadTimeDays(report: SourcingScoutResponse): number | null {
    if (report.estimatedLifespanDays != null && report.timeGapDays != null) {
      return report.estimatedLifespanDays - report.timeGapDays;
    }
    return null;
  }

  /** 取得時效落差的結論文字 */
  getTimeGapVerdict(gapDays: number | null): string {
    if (gapDays === null) return '資料不足待評估';
    if (gapDays < 0) return '高風險，直接淘汰';
    if (gapDays <= 14) return '高風險，需加速尋源';
    return '可行，時效充裕';
  }

  /** 點擊「存為觀察」 */
  saveAsWatching(report: SourcingScoutResponse) {
    if (!report?.canWatch || this.isActionPending()) return;

    this.isActionPending.set(true);
    const request = report.itemId != null && report.productId == null
      ? this.sourcingService.watchResult({ itemId: report.itemId })
      : this.sourcingService.watch({ productId: report.productId! });

    request.subscribe({
      next: async (res: any) => {
        const response = await this.unpack(res);
        const data = response?.data ?? response;
        this.isActionPending.set(false);
        if (report.itemId != null && report.productId == null) {
          this.scoutReport.set(data);
        } else if (report.productId != null) {
          this.fetchReport(report.productId);
        }
        this.dialogService.Confirm({
          title: '操作成功',
          message: '已成功將此品項標記並儲存為「觀察中」！',
          confirmText: '確定',
          isDanger: false
        });
      },
      error: async (err: any) => {
        this.isActionPending.set(false);
        console.error('儲存為觀察失敗', err);
        this.dialogService.Confirm({
          title: '儲存失敗',
          message: await this.getApiErrorMessage(err, '更新品項狀態失敗，請稍後再試！'),
          confirmText: '確定',
          isDanger: true
        });
      }
    });
  }

  /** 點擊「加入尋源優先序」 */
  canSaveAsWatching(report: SourcingScoutResponse | null): boolean {
    return Boolean(report?.canWatch) && !this.isActionPending();
  }

  canAddToSourcingQueue(report: SourcingScoutResponse | null): boolean {
    return Boolean(report?.canPrioritize)
      && report?.timeGapDays != null
      && report.timeGapDays >= 0
      && !this.isActionPending();
  }

  addToSourcingQueue(report: SourcingScoutResponse) {
    if (!this.canAddToSourcingQueue(report)) {
      this.dialogService.Confirm({
        title: '無法加入尋源',
        message: report?.prioritizeDisabledReason
          ?? '目前資料不符合加入尋源優先序的條件。',
        confirmText: '我知道了',
        isDanger: true
      });
      return;
    }

    this.isActionPending.set(true);
    const request = report.itemId != null && report.productId == null
      ? this.sourcingService.prioritizeResult({ itemId: report.itemId })
      : this.sourcingService.prioritize({ productId: report.productId! });

    request.subscribe({
      next: async (res: any) => {
        const response = await this.unpack(res);
        const data = response?.data ?? response;
        const targetStatus = data?.sourcingStatus;
        this.isActionPending.set(false);
        if (report.itemId != null && report.productId == null) {
          this.scoutReport.set(data);
        } else if (report.productId != null) {
          this.fetchReport(report.productId);
        }
        const statusText = targetStatus === 'REJECTED'
          ? '已淘汰'
          : targetStatus === 'URGENT' ? '需加速尋源' : '尋源中';
        this.dialogService.Confirm({
          title: '尋源成功',
          message: `已成功將品項加入「尋源優先序清單」（狀態：${statusText}）！`,
          confirmText: '確定',
          isDanger: false
        });
      },
      error: async (err: any) => {
        this.isActionPending.set(false);
        console.error('加入尋源優先序失敗', err);
        this.dialogService.Confirm({
          title: '操作失敗',
          message: await this.getApiErrorMessage(err, '加入尋源優先序失敗，請稍後再試！'),
          confirmText: '確定',
          isDanger: true
        });
      }
    });
  }

  getPrioritizeDisabledReason(report: SourcingScoutResponse): string {
    if (this.isActionPending()) return '操作處理中，請稍候。';
    if (report.timeGapDays != null && report.timeGapDays < 0) {
      return '時效落差為負值，不可加入尋源清單。';
    }
    return report.prioritizeDisabledReason ?? '';
  }

  private async getApiErrorMessage(err: any, fallback: string): Promise<string> {
    const body = err?.error instanceof Blob ? await this.unpack(err.error) : err?.error;
    return body?.error?.message
      ?? body?.message
      ?? err?.message
      ?? fallback;
  }



}
