import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, finalize, map, Observable, tap, throwError } from 'rxjs';
import { ProductControllerService } from '../../api/api/productController.service';
import {
  ProductCreateRequest,
  ProductResponse,
  ProductUpdateRequest,
} from '../../api/model/models';

export interface ProductSaveResult {
  product: ProductResponse;
  warnings: readonly string[];
}

/**
 * OpenAPI Generator maps `uniqueItems: true` arrays to JavaScript Set values.
 * Angular serializes Set as `{}`, so requests sent over JSON must keep these
 * fields as arrays even though the generated client model says Set.
 */
export type ProductSaveRequest = Omit<
  ProductCreateRequest,
  'logisticsConditions' | 'keywordIds'
> & {
  logisticsConditions?: ProductCreateRequest.LogisticsConditionsEnum[];
  keywordIds?: number[];
};

@Injectable({ providedIn: 'root' })
export class ProductEditorService {
  private readonly api = inject(ProductControllerService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  load(productId: number): Observable<ProductResponse> {
    this.loading.set(true);
    this.error.set(null);

    return this.api.getById({ id: productId }).pipe(
      map((response) => unwrap(response, '取得品項資料失敗')),
      this.handleError(),
      finalize(() => this.loading.set(false)),
    );
  }

  save(productId: number | null, request: ProductSaveRequest): Observable<ProductSaveResult> {
    this.saving.set(true);
    this.error.set(null);

    const action =
      productId == null
        ? this.api.create({ productCreateRequest: request as unknown as ProductCreateRequest })
        : this.api.update({
            id: productId,
            productUpdateRequest: request as unknown as ProductUpdateRequest,
          });

    return action.pipe(
      map((response) => {
        const result = unwrap(response, '儲存品項失敗');
        if (!result.product?.id) {
          throw new Error('後端未回傳已儲存的品項');
        }
        return {
          product: result.product,
          warnings: result.warnings ?? [],
        };
      }),
      this.handleError(),
      finalize(() => this.saving.set(false)),
    );
  }

  clearError(): void {
    this.error.set(null);
  }

  private handleError<T>() {
    return catchError<T, Observable<never>>((error: unknown) => {
      this.error.set(toErrorMessage(error));
      return throwError(() => error);
    });
  }
}

function unwrap<T>(
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
  return error instanceof Error ? error.message : '儲存品項失敗';
}
