import { Component } from '@angular/core';
import { 
  AITasksService,
  AiBudgetControllerService, 
  AiTaskControllerService, 
  CategoryControllerService, 
  CategoryTreeResponse, 
  SourcingScoutControllerService 
} from '../../api';
import { inject } from '@angular/core';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../services/dialog-service';

@Component({
  selector: 'app-sourcing',
  imports: [MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule, CommonModule],
  templateUrl: './sourcing.component.html',
  styleUrl: './sourcing.component.scss'
})
export class SourcingComponent {
  private readonly categoryService = inject(CategoryControllerService);
  private soucingService = inject(SourcingScoutControllerService);
  private aiTaskService = inject(AiTaskControllerService);
  private aiTasksService = inject(AITasksService);
  private aiBudgetService = inject(AiBudgetControllerService);
  private readonly dialogService = inject(DialogService);

  executionSeconds = signal<number>(0);
  private scoutStartTime = 0;
  categories = signal<CategoryTreeResponse[]>([]);
  selectedCategoryId = signal<number | null>(null);
  keyword = signal<string>('');
  scoutReport = signal<any | null>(null);
  frequency = signal<string>('0/50');
  isQuotaExhausted = signal<boolean>(false);

  ngOnInit() {
    this.fetchBudget();

    this.categoryService.getCategories().subscribe({
      next: async (res) => {
        const responseData = await this.unpack(res);
        this.categories.set(responseData?.data ?? []);
        console.log('品類取得成功', responseData?.data);
      },
      error: (err) => {
        console.error('品類取得失敗', err);
      }
    });
  }

  fetchBudget() {
    this.aiBudgetService.current().subscribe({
      next: async (res) => {
        const responseData = await this.unpack(res);
        const pools = responseData?.data?.pools ?? responseData?.pools ?? [];
        const trackBPool = pools.find((p: any) => p.pool === 'TRACK_B');
        if (trackBPool) {
          const used = trackBPool.used ?? 0;
          const limit = trackBPool.limit ?? 50;
          this.frequency.set(`${used}/${limit}`);
          this.isQuotaExhausted.set(trackBPool.status === 'EXHAUSTED');
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

    this.scoutStartTime = Date.now();

    this.soucingService.scout({
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
          console.error('無法從後端回應取得 taskId', responseData);
          return;
        }

        this.pollAiTask(taskId, productId);
      },
      error: (err) => {
        console.error('發起探索失敗', err);
      }
    });
  }

  private pollAiTask(taskId: number, productId?: number) {
    if (!taskId) return;

    const timer = setInterval(() => {
      this.aiTaskService.getById1({ id: taskId }).subscribe({
        next: async (res) => {
          const responseData = await this.unpack(res);
          const task = responseData?.data ?? responseData;
          console.log('輪詢進度：', task);

          if (task?.status === 'SUCCEEDED' || task?.status === 'COMPLETED') {
            clearInterval(timer);

            if (productId) {
              this.fetchReport(productId);
            } else {
              // 若 response 沒帶 productId，從任務品項 (items) 取得
              this.aiTasksService.items({ taskId }).subscribe({
                next: async (itemsRes) => {
                  const itemsData = await this.unpack(itemsRes);
                  const items = itemsData?.data ?? itemsData ?? [];
                  const pId = items?.[0]?.productId;
                  if (pId) {
                    this.fetchReport(pId);
                  } else {
                    console.error('無法在任務項目中找到 productId', itemsData);
                  }
                },
                error: (err) => {
                  console.error('查詢任務品項失敗', err);
                }
              });
            }

          } else if (task?.status === 'FAILED') {
            clearInterval(timer);
            this.dialogService.Confirm({
              title: '探索失敗',
              message: 'AI 尋源探索失敗，請稍後再試！',
              confirmText: '確定',
              isDanger: true
            });
          }
        },
        error: (err) => {
          console.error('查詢進度失敗', err);
          clearInterval(timer);
        }
      });
    }, 1500);
  }

  private fetchReport(productId: number) {
    this.soucingService.latest1({ productId }).subscribe({
      next: async (res) => {
        const responseData = await this.unpack(res);
        this.scoutReport.set(responseData?.data ?? responseData);
        const elapsed = Math.max(1, Math.round((Date.now() - this.scoutStartTime) / 1000));
        this.executionSeconds.set(elapsed);
        this.fetchBudget(); // 更新最新使用次數
        console.log('尋源報告取得成功', responseData);
      },
      error: (err) => {
        console.error('取得尋源報告失敗', err);
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
      GROWING: '成長期',
      STABLE: '穩定期',
      DECLINING: '衰退期',
      EMERGING: '萌芽期'
    };
    return stage ? (map[stage] || stage) : '評估中';
  }

  /** 計算前置期天數（壽命 - 落差） */
  getLeadTimeDays(report: any): number {
    if (report.estimatedLifespanDays != null && report.timeGapDays != null) {
      return report.estimatedLifespanDays - report.timeGapDays;
    }
    return 21; // 預設
  }

  /** 取得時效落差的結論文字 */
  getTimeGapVerdict(gapDays: number | null): string {
    if (gapDays === null) return '資料不足待評估';
    if (gapDays < 0) return '高風險，直接淘汰';
    if (gapDays <= 14) return '高風險，需加速尋源';
    return '可行，時效充裕';
  }

  /** 點擊「存為觀察」 */
  saveAsWatching(productId: number) {
    this.dialogService.Confirm({
      title: '操作確認',
      message: '已將此品項狀態標記為「觀察中」！',
      confirmText: '確定',
      cancelText: '',
      isDanger: false
    });
  }

  /** 點擊「加入尋源優先序」 */
  addToSourcingQueue(report: any) {
    if (report.timeGapDays !== null && report.timeGapDays < 0) {
      this.dialogService.Confirm({
        title: '無法加入尋源',
        message: '此商品時效落差為負（來不及上架），依否決規則不可加入尋源優先序！',
        confirmText: '我知道了',
        isDanger: true
      });
      return;
    }
    this.dialogService.Confirm({
      title: '尋源成功',
      message: '已成功將品項加入「尋源優先序清單」！',
      confirmText: '確定',
      cancelText: '',
      isDanger: false
    });
  }
}
