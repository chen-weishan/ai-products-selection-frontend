import { Component } from '@angular/core';
import { AiTaskControllerService, CategoryControllerService, CategoryTreeResponse, SourcingScoutControllerService } from '../../api'
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
  private readonly dialogService = inject(DialogService);

  categories = signal<CategoryTreeResponse[]>([]);
  selectedCategoryId = signal<number | null>(null);
  keyword = signal<string>('');
  scoutReport = signal<any | null>(null);
  ngOnInit() {
    this.categoryService.getCategories().subscribe({
      next: async (res) => {
        let responseData: any = res;

        // 處理 OpenAPI 可能回傳 Blob 的問題
        if (res instanceof Blob) {
          try {
            const text = await res.text();
            responseData = JSON.parse(text);
          } catch (e) {
            console.error('解析 Blob 失敗:', e);
          }
        }

        this.categories.set(responseData.data ?? [])
        console.log('回傳成功', responseData.data)
      },
      error: (err) => {
        console.log('品類取得失敗', err);
      }
    })
  }

  startScout() {
    const keyword = this.keyword().trim();
    const categoryId = this.selectedCategoryId();
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

    this.soucingService.scout({
      sourcingScoutRequest: {
        keyword: keyword,
        categoryId: categoryId,
        forceRefresh: false,
      }
    }).subscribe({
      next: async (res) => {
        console.log('回傳成功', res)
        const taskId = res.data?.taskId!;
        const productId = (res.data as any)?.productId!;
        this.pollAiTask(taskId, productId);

      },
      error: (err) => {
        console.log('品類取得失敗', err);
      }
    });
  }

  private pollAiTask(taskId: number, productId: number) {
    const timer = setInterval(() => {
      this.aiTaskService.getById1({ id: taskId }).subscribe({
        next: (res) => {
          if (res.data?.status == 'SUCCEEDED' || (res.data?.status as any) === 'COMPLETED') {
            clearInterval(timer);

            if (productId) {
              this.fetchReport(productId);
            }

          } else if (res.data?.status === 'FAILED') {
            clearInterval(timer);
            alert('AI 尋源探索失敗，請稍後再試！');
          }
        }, error: (err) => {
          console.log('查詢進度失敗', err);
          clearInterval(timer);
          this.dialogService.Confirm({
            title: '探索失敗',
            message: 'AI 尋源探索失敗，請稍後再試！',
            confirmText: '確定',
            isDanger: true // 紅色警示風格
          });
        }
      })
    }, 1500);
  }

  private fetchReport(productId: number) {
    this.soucingService.latest1({ productId }).subscribe({
      next: (res) => {
        this.scoutReport.set(res.data);
        console.log('尋源報告取得成功', res.data);
      },
      error: (err) => {
        console.error('取得尋源報告失敗', err);
      }
    });
  }

  frequency = '18/50';
}

//假資料






