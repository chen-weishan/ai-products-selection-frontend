import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, map, Observable, tap, throwError } from 'rxjs';
import {
  PageResponseProductListItemResponse,
  ProductListItemResponse,
} from '../../api/model/models';
import { ProductControllerService } from '../../api/api/productController.service';
import { SearchRequestParams } from '../../api/api/productController.serviceInterface';

export type ProductSearchCriteria = Omit<SearchRequestParams, 'pageable'> & {
  page?: number;
  size?: 20 | 50 | 100;
  sort?: string[];
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

  load(criteria: ProductSearchCriteria = {}): Observable<PageResponseProductListItemResponse> {
    const { page = 0, size = 20, sort = ['latestScore,desc'], ...filters } = criteria;

    this.loading.set(true);
    this.error.set(null);

    return this.api
      .search({
        ...filters,
        pageable: { page, size, sort },
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
