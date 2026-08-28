import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  catchError,
  concatMap,
  finalize,
  forkJoin,
  map,
  Observable,
  of,
  switchMap,
  tap,
  throwError,
  toArray,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductImageResponse } from '../../api/model/models';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string };
}

export interface ProductImageView extends ProductImageResponse {
  previewUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductImageService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/products`;

  readonly images = signal<readonly ProductImageView[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(productId: number): Observable<readonly ProductImageView[]> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .get<ApiResponse<ProductImageResponse[]>>(`${this.baseUrl}/${productId}/images`)
      .pipe(
        map((response) => unwrap(response, '取得品項圖片失敗')),
        switchMap((images) => {
          if (images.length === 0) {
            return of([] as ProductImageView[]);
          }
          return forkJoin(
            images.map((image) =>
              this.loadPreview(productId, image).pipe(
                catchError(() => of({ ...image } as ProductImageView)),
              ),
            ),
          );
        }),
        tap((images) => {
          this.revokePreviewUrls();
          this.images.set([...images].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
        }),
        this.handleError(),
        finalize(() => this.loading.set(false)),
      );
  }

  uploadFiles(productId: number, files: readonly File[]): Observable<readonly ProductImageView[]> {
    this.loading.set(true);
    this.error.set(null);

    return of(...files).pipe(
      concatMap((file) => {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return this.http.post<ApiResponse<ProductImageResponse>>(
          `${this.baseUrl}/${productId}/images`,
          formData,
        );
      }),
      toArray(),
      switchMap(() => this.load(productId)),
      this.handleError(),
      finalize(() => this.loading.set(false)),
    );
  }

  delete(productId: number, imageId: number): Observable<readonly ProductImageView[]> {
    this.loading.set(true);
    this.error.set(null);
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/${productId}/images/${imageId}`)
      .pipe(
        switchMap(() => this.load(productId)),
        this.handleError(),
        finalize(() => this.loading.set(false)),
      );
  }

  reorder(productId: number, imageIds: readonly number[]): Observable<readonly ProductImageView[]> {
    this.loading.set(true);
    this.error.set(null);
    return this.http
      .patch<ApiResponse<ProductImageResponse[]>>(`${this.baseUrl}/${productId}/images/order`, {
        imageIds,
      })
      .pipe(
        switchMap(() => this.load(productId)),
        this.handleError(),
        finalize(() => this.loading.set(false)),
      );
  }

  clear(): void {
    this.revokePreviewUrls();
    this.images.set([]);
    this.error.set(null);
  }

  private loadPreview(
    productId: number,
    image: ProductImageResponse,
  ): Observable<ProductImageView> {
    return this.http
      .get(`${this.baseUrl}/${productId}/images/${image.id}/content`, {
        responseType: 'blob',
      })
      .pipe(map((blob) => ({ ...image, previewUrl: URL.createObjectURL(blob) })));
  }

  private revokePreviewUrls(): void {
    this.images().forEach((image) => {
      if (image.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
  }

  private handleError<T>() {
    return catchError<T, Observable<never>>((error: unknown) => {
      this.error.set(toErrorMessage(error));
      return throwError(() => error);
    });
  }
}

function unwrap<T>(response: ApiResponse<T>, fallbackMessage: string): T {
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
  return error instanceof Error ? error.message : '品項圖片處理失敗';
}
