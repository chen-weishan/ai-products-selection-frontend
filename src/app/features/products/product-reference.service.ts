import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, map, Observable, tap, throwError } from 'rxjs';
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

@Injectable({
  providedIn: 'root',
})
export class ProductReferenceService {
  private readonly api = inject(ProductReferenceControllerService);

  readonly categories = signal<readonly CategoryOption[]>([]);
  readonly suppliers = signal<readonly SupplierResponse[]>([]);
  readonly trendKeywords = signal<readonly TrendKeywordResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): Observable<void> {
    this.loading.set(true);
    this.error.set(null);

    return forkJoin({
      categories: this.api.getCategories(),
      suppliers: this.api.getSuppliers({}),
    }).pipe(
      map(({ categories, suppliers }) => {
        if (!categories.success || !categories.data) {
          throw new Error(categories.error?.message ?? '取得品項類別失敗');
        }
        if (!suppliers.success || !suppliers.data) {
          throw new Error(suppliers.error?.message ?? '取得供應商失敗');
        }

        return {
          categories: flattenCategories(categories.data),
          suppliers: suppliers.data,
        };
      }),
      tap(({ categories, suppliers }) => {
        this.categories.set(categories);
        this.suppliers.set(suppliers);
      }),
      map(() => undefined),
      catchError((error: unknown) => {
        this.error.set(toErrorMessage(error));
        return throwError(() => error);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  loadTrendKeywords(): Observable<void> {
    return this.api.getTrendKeywords({ enabled: true }).pipe(
      map((response) => {
        if (!response.success || !response.data) {
          throw new Error(response.error?.message ?? '取得趨勢關鍵字失敗');
        }
        return response.data;
      }),
      tap((keywords) => this.trendKeywords.set(keywords)),
      map(() => undefined),
      catchError((error: unknown) => {
        this.error.set(toErrorMessage(error));
        return throwError(() => error);
      }),
    );
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
