import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, Injectable, inject, OnDestroy, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  MonoTypeOperatorFunction,
  Observable,
  Subscription,
  switchMap,
  tap,
  timer,
  timeout,
  throwError,
} from 'rxjs';
import {
  PageResponseProductListItemResponse,
  ProductBatchAnalyzeResponse,
  ProductBatchCategoryResponse,
  ProductBatchDisableResponse,
  ProductListItemResponse,
  ProductStatusUpdateRequest,
  ProductStatusUpdateResponse,
} from '../../api/model/models';
import { ProductControllerService } from '../../api/api/productController.service';
import { SearchRequestParams } from '../../api/api/productController.serviceInterface';
import { environment } from '../../../environments/environment';

export type ProductSearchCriteria = Omit<SearchRequestParams, 'size'> & {
  size?: 20 | 50 | 100;
};

type AnalysisTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL' | 'CANCELLED';

interface AnalysisTaskStatusResponse {
  taskId: number;
  status: AnalysisTaskStatus;
  totalCount: number;
  successCount: number;
  failCount: number;
  progressPercent: number;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string };
}

const ANALYSIS_POLL_INTERVAL_MS = 2_000;
const ANALYSIS_REQUEST_TIMEOUT_MS = 5_000;
const ANALYSIS_POLL_TIMEOUT_MS = 30_000;

@Injectable({
  providedIn: 'root',
})
export class ProductService implements OnDestroy {
  private readonly api = inject(ProductControllerService);
  private readonly http = inject(HttpClient);
  private readonly analysisPolls = new Map<number, Subscription>();
  private lastCriteria: ProductSearchCriteria = {};

  readonly products = signal<readonly ProductListItemResponse[]>([]);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly batchLoading = signal(false);
  readonly batchMessage = signal<string | null>(null);
  readonly batchError = signal<string | null>(null);
  readonly analysisMessage = signal<string | null>(null);
  readonly analysisError = signal<string | null>(null);
  readonly pendingAnalysisTaskIds = signal<readonly number[]>([]);
  readonly analysisPolling = computed(() => this.pendingAnalysisTaskIds().length > 0);

  load(criteria: ProductSearchCriteria = {}): Observable<PageResponseProductListItemResponse> {
    this.lastCriteria = { ...criteria, sort: criteria.sort ? [...criteria.sort] : undefined };
    const { page = 0, size = 20, sort = ['latestScore,desc'], ...filters } = criteria;

    this.loading.set(true);
    this.error.set(null);

    return this.api
      .search({
        ...filters,
        page,
        size,
        sort,
      })
      .pipe(
        map((response) => {
          if (!response.success || !response.data) {
            throw new Error(response.error?.message ?? '取得品項清單失敗');
          }
          return response.data;
        }),
        tap((result) => {
          this.products.set(result.content ?? []);
          this.page.set(result.page ?? page);
          this.size.set(result.size ?? size);
          this.totalElements.set(result.totalElements ?? 0);
          this.totalPages.set(result.totalPages ?? 0);
        }),
        catchError((error: unknown) => {
          this.error.set(toErrorMessage(error));
          return throwError(() => error);
        }),
        finalize(() => this.loading.set(false)),
      );
  }

  analyzeBatch(productIds: readonly number[]): Observable<ProductBatchAnalyzeResponse> {
    this.startBatchAction();

    return this.api
      .analyzeBatch({
        productBatchAnalyzeRequest: {
          productIds: [...productIds],
        },
      })
      .pipe(
        map((response) => unwrapResponse(response, '批次加入評分佇列失敗')),
        tap((result) => {
          this.batchMessage.set(
            `已將 ${result.queuedCount ?? productIds.length} 筆品項加入評分佇列`,
          );
          if (result.taskId == null) {
            this.analysisError.set('後端未回傳評分任務編號，無法自動追蹤結果');
            return;
          }
          this.startAnalysisPolling(result.taskId, productIds.length);
        }),
        this.handleBatchError(),
        finalize(() => this.batchLoading.set(false)),
      );
  }

  assignCategory(
    productIds: readonly number[],
    categoryId: number,
  ): Observable<ProductBatchCategoryResponse> {
    this.startBatchAction();

    return this.api
      .assignCategory({
        productBatchCategoryRequest: {
          productIds: [...productIds],
          categoryId,
        },
      })
      .pipe(
        map((response) => unwrapResponse(response, '批次指定類別失敗')),
        tap((result) => {
          this.batchMessage.set(
            `已將 ${result.updatedCount ?? productIds.length} 筆品項指定為${result.categoryName ? `「${result.categoryName}」` : '新類別'}`,
          );
        }),
        this.handleBatchError(),
        finalize(() => this.batchLoading.set(false)),
      );
  }

  disableBatch(productIds: readonly number[]): Observable<ProductBatchDisableResponse> {
    this.startBatchAction();

    return this.api
      .disableBatch({
        productBatchDisableRequest: {
          productIds: [...productIds],
        },
      })
      .pipe(
        map((response) => unwrapResponse(response, '批次停用失敗')),
        tap((result) => {
          this.batchMessage.set(`已停用 ${result.disabledCount ?? productIds.length} 筆品項`);
        }),
        this.handleBatchError(),
        finalize(() => this.batchLoading.set(false)),
      );
  }

  deleteProduct(productId: number): Observable<void> {
    this.startBatchAction();

    return this.api._delete({ id: productId }).pipe(
      map((response) => {
        if (!response.success) {
          throw new Error(response.error?.message ?? '刪除品項失敗');
        }
      }),
      tap(() => this.batchMessage.set('品項已刪除')),
      this.handleBatchError(),
      finalize(() => this.batchLoading.set(false)),
    );
  }

  changeStatus(
    productId: number,
    request: ProductStatusUpdateRequest,
  ): Observable<ProductStatusUpdateResponse> {
    this.startBatchAction();

    return this.api
      .changeStatus({
        id: productId,
        productStatusUpdateRequest: request,
      })
      .pipe(
        map((response) => unwrapResponse(response, '變更品項狀態失敗')),
        tap(() => this.batchMessage.set('品項狀態已更新')),
        this.handleBatchError(),
        finalize(() => this.batchLoading.set(false)),
      );
  }

  clearBatchFeedback(): void {
    this.batchMessage.set(null);
    this.batchError.set(null);
  }

  ngOnDestroy(): void {
    this.analysisPolls.forEach((subscription) => subscription.unsubscribe());
    this.analysisPolls.clear();
  }

  private startAnalysisPolling(taskId: number, productCount: number): void {
    this.stopAnalysisPolling(taskId);
    this.analysisError.set(null);
    this.analysisMessage.set(`評分任務 #${taskId} 已排入，正在等待 ${productCount} 筆品項完成…`);
    this.pendingAnalysisTaskIds.update((ids) => [...new Set([...ids, taskId])]);
    const startedAt = Date.now();

    const subscription = timer(ANALYSIS_POLL_INTERVAL_MS, ANALYSIS_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.http
            .get<ApiResponse<AnalysisTaskStatusResponse>>(
              `${environment.apiBaseUrl}/ai/tasks/${taskId}`,
            )
            .pipe(timeout(ANALYSIS_REQUEST_TIMEOUT_MS)),
        ),
        map((response) => unwrapResponse(response, '取得評分任務狀態失敗')),
      )
      .subscribe({
        next: (task) => {
          if (isTerminalAnalysisStatus(task.status)) {
            this.finishAnalysisPolling(task);
            return;
          }
          this.analysisMessage.set(`評分任務 #${taskId} 執行中（${task.progressPercent}%）…`);
          if (Date.now() - startedAt >= ANALYSIS_POLL_TIMEOUT_MS) {
            this.stopAnalysisPolling(taskId);
            this.analysisMessage.set(null);
            this.analysisError.set(
              `評分任務 #${taskId} 等待超過 30 秒；任務可能仍在背景執行，請稍後重新整理清單`,
            );
          }
        },
        error: (error: unknown) => {
          this.stopAnalysisPolling(taskId);
          this.analysisMessage.set(null);
          this.analysisError.set(`無法追蹤評分任務 #${taskId}：${toErrorMessage(error)}`);
        },
      });
    this.analysisPolls.set(taskId, subscription);
  }

  private finishAnalysisPolling(task: AnalysisTaskStatusResponse): void {
    this.stopAnalysisPolling(task.taskId);
    if (task.status === 'SUCCEEDED') {
      this.analysisError.set(null);
      this.analysisMessage.set(`評分完成：${task.successCount} 筆成功，清單已自動更新`);
    } else {
      this.analysisMessage.set(null);
      this.analysisError.set(
        `評分任務 #${task.taskId} ${analysisStatusLabel(task.status)}：${task.successCount} 筆成功、${task.failCount} 筆失敗`,
      );
    }
    this.load(this.lastCriteria).subscribe({
      error: () => {
        this.analysisError.set('評分任務已結束，但重新載入品項清單失敗');
      },
    });
  }

  private stopAnalysisPolling(taskId: number): void {
    this.analysisPolls.get(taskId)?.unsubscribe();
    this.analysisPolls.delete(taskId);
    this.pendingAnalysisTaskIds.update((ids) => ids.filter((id) => id !== taskId));
  }

  private startBatchAction(): void {
    this.batchLoading.set(true);
    this.clearBatchFeedback();
  }

  private handleBatchError<T>(): MonoTypeOperatorFunction<T> {
    return catchError<T, Observable<never>>((error: unknown) => {
      this.batchError.set(toErrorMessage(error));
      return throwError(() => error);
    });
  }
}

function isTerminalAnalysisStatus(status: AnalysisTaskStatus): boolean {
  return ['SUCCEEDED', 'FAILED', 'PARTIAL', 'CANCELLED'].includes(status);
}

function analysisStatusLabel(status: AnalysisTaskStatus): string {
  switch (status) {
    case 'FAILED':
      return '執行失敗';
    case 'PARTIAL':
      return '部分完成';
    case 'CANCELLED':
      return '已取消';
    default:
      return status;
  }
}

function unwrapResponse<T>(
  response: { success?: boolean; data?: T; error?: { message?: string } },
  fallbackMessage: string,
): T {
  if (!response.success || response.data == null) {
    throw new Error(response.error?.message ?? fallbackMessage);
  }
  return response.data;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const apiMessage = error.error?.error?.message;
    return typeof apiMessage === 'string' ? apiMessage : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '取得品項清單失敗';
}
