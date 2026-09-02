import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, defer, finalize, forkJoin, map, Observable, tap, throwError } from 'rxjs';
import { ProductReferenceControllerService } from '../../api/api/productReferenceController.service';
import {
  CategoryTreeResponse,
  SupplierResponse,
  TrendKeywordResponse,
} from '../../api/model/models';

export interface CategoryOption {
  id: number;
  label: string;
}

export interface CategoryMarginMedian {
  categoryId: number;
  categoryName: string;
  medianMarginRate: number | null;
  sampleCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductReferenceService {
  private readonly api = inject(ProductReferenceControllerService);
  private readonly pendingOperations = signal(0);

  readonly categories = signal<readonly CategoryOption[]>([]);
  readonly suppliers = signal<readonly SupplierResponse[]>([]);
  readonly trendKeywords = signal<readonly TrendKeywordResponse[]>([]);
  readonly categoryMarginMedian = signal<CategoryMarginMedian | null>(null);
  readonly categoryMarginMedianError = signal<string | null>(null);
  readonly categoryError = signal<string | null>(null);
  readonly supplierError = signal<string | null>(null);
  readonly trendKeywordError = signal<string | null>(null);
  readonly loading = computed(() => this.pendingOperations() > 0);
  readonly error = signal<string | null>(null);

  load(): Observable<void> {
    this.error.set(null);
    return forkJoin({
      categories: this.loadCategories(),
      suppliers: this.loadSuppliers(),
    }).pipe(
      map(() => undefined),
      catchError((error: unknown) => {
        this.error.set(toErrorMessage(error));
        return throwError(() => error);
      }),
    );
  }

  loadCategories(): Observable<readonly CategoryOption[]> {
    this.categoryError.set(null);
    return this.track(
      this.api.getCategories().pipe(
        map((response) => {
          if (!response.success || !response.data) {
            throw new Error(response.error?.message ?? '取得品項類別失敗');
          }
          return flattenCategories(response.data);
        }),
        tap((categories) => this.categories.set(categories)),
        catchError((error: unknown) => {
          const message = toErrorMessage(error);
          this.categoryError.set(message);
          this.error.set(message);
          return throwError(() => error);
        }),
      ),
    );
  }

  loadSuppliers(): Observable<readonly SupplierResponse[]> {
    this.supplierError.set(null);
    return this.track(
      this.api.getSuppliers({}).pipe(
        map((response) => {
          if (!response.success || !response.data) {
            throw new Error(response.error?.message ?? '取得供應商失敗');
          }
          return response.data;
        }),
        tap((suppliers) => this.suppliers.set(suppliers)),
        catchError((error: unknown) => {
          this.supplierError.set(toErrorMessage(error));
          return throwError(() => error);
        }),
      ),
    );
  }

  loadTrendKeywords(): Observable<void> {
    this.trendKeywordError.set(null);
    return this.track(
      this.api.getTrendKeywords({ enabled: true }).pipe(
        map((response) => {
          if (!response.success || !response.data) {
            throw new Error(response.error?.message ?? '取得趨勢關鍵字失敗');
          }
          return response.data;
        }),
        tap((keywords) => this.trendKeywords.set(keywords)),
        map(() => undefined),
        catchError((error: unknown) => {
          const message = toErrorMessage(error);
          this.trendKeywordError.set(message);
          this.error.set(message);
          return throwError(() => error);
        }),
      ),
    );
  }

  loadCategoryMarginMedian(categoryId: number): Observable<CategoryMarginMedian> {
    this.categoryMarginMedianError.set(null);
    return this.api.getCategoryMarginMedian({ categoryId }).pipe(
      map((response) => {
        const data = response.data;
        if (!response.success || !data || data.categoryId == null || !data.categoryName) {
          throw new Error(response.error?.message ?? '取得類別毛利率中位數失敗');
        }
        return {
          categoryId: data.categoryId,
          categoryName: data.categoryName,
          medianMarginRate: data.medianMarginRate ?? null,
          sampleCount: data.sampleCount ?? 0,
        };
      }),
      tap((statistics) => this.categoryMarginMedian.set(statistics)),
      catchError((error: unknown) => {
        this.categoryMarginMedian.set(null);
        this.categoryMarginMedianError.set(toErrorMessage(error));
        return throwError(() => error);
      }),
    );
  }

  clearCategoryMarginMedian(): void {
    this.categoryMarginMedian.set(null);
    this.categoryMarginMedianError.set(null);
  }

  private track<T>(source: Observable<T>): Observable<T> {
    return defer(() => {
      this.pendingOperations.update((count) => count + 1);
      return source.pipe(
        finalize(() => this.pendingOperations.update((count) => Math.max(0, count - 1))),
      );
    });
  }
}

function flattenCategories(
  categories: readonly CategoryTreeResponse[],
  depth = 0,
): CategoryOption[] {
  return categories.flatMap((category) => {
    const current =
      category.id == null || !category.name
        ? []
        : [
            {
              id: category.id,
              label: `${'— '.repeat(depth)}${category.name}`,
            },
          ];

    return [...current, ...flattenCategories(category.children ?? [], depth + 1)];
  });
}

function toErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const apiMessage = error.error?.error?.message;
    return typeof apiMessage === 'string' ? apiMessage : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '取得品項篩選資料失敗';
}
