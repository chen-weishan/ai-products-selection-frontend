import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  catchError,
  finalize,
  map,
  MonoTypeOperatorFunction,
  Observable,
  tap,
  throwError,
} from 'rxjs';
import {
  PageResponseProductListItemResponse,
  ProductBatchAnalyzeResponse,
  ProductBatchCategoryResponse,
  ProductBatchDisableResponse,
  ProductListItemResponse,
} from '../../api/model/models';
import { ProductControllerService } from '../../api/api/productController.service';
import { SearchRequestParams } from '../../api/api/productController.serviceInterface';

export type ProductSearchCriteria = Omit<SearchRequestParams, 'size'> & {
  size?: 20 | 50 | 100;
};

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly api = inject(ProductControllerService);

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

  load(criteria: ProductSearchCriteria = {}): Observable<PageResponseProductListItemResponse> {
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
        productBatchAnalyzeRequest: { productIds: new Set(productIds) },
      })
      .pipe(
        map((response) => unwrapResponse(response, '批次加入評分佇列失敗')),
        tap((result) => {
          this.batchMessage.set(
            `已將 ${result.queuedCount ?? productIds.length} 筆品項加入評分佇列`,
          );
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
          productIds: new Set(productIds),
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
        productBatchDisableRequest: { productIds: new Set(productIds) },
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

  clearBatchFeedback(): void {
    this.batchMessage.set(null);
    this.batchError.set(null);
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
