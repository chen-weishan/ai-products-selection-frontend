import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, catchError, defer, finalize, map, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string };
}

export interface FestivalOption {
  festivalCode: string;
  festivalName: string;
}

export interface ProductFestivalAffinity {
  festivalCode: string;
  festivalName?: string;
  affinity: number;
}

export interface ProductReviewFileUploadResult {
  fileName: string;
  acceptedRows: number;
  insertedCount: number;
  duplicateCount: number;
  totalReviewCount: number;
  lowConfidence: boolean;
}

export interface ProductReviewSummary {
  totalReviewCount: number;
  lowConfidence: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductSupplementService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly pendingOperations = signal(0);

  readonly festivals = signal<readonly FestivalOption[]>([]);
  readonly affinities = signal<readonly ProductFestivalAffinity[]>([]);
  readonly reviewUploadResult = signal<ProductReviewFileUploadResult | null>(null);
  readonly reviewSummary = signal<ProductReviewSummary | null>(null);
  readonly loading = computed(() => this.pendingOperations() > 0);
  readonly error = signal<string | null>(null);
  readonly festivalError = signal<string | null>(null);
  readonly affinityError = signal<string | null>(null);
  readonly reviewSummaryError = signal<string | null>(null);

  loadFestivals(): Observable<readonly FestivalOption[]> {
    this.festivalError.set(null);
    return this.track(
      this.http.get<ApiResponse<FestivalOption[]>>(`${this.baseUrl}/festivals`).pipe(
        map((response) => unwrap(response, '取得節慶清單失敗')),
        tap((festivals) => this.festivals.set(festivals)),
      ),
      this.festivalError,
    );
  }

  loadAffinities(productId: number): Observable<readonly ProductFestivalAffinity[]> {
    this.affinityError.set(null);
    return this.track(
      this.http
        .get<ApiResponse<ProductFestivalAffinity[]>>(
          `${this.baseUrl}/products/${productId}/festival-affinity`,
        )
        .pipe(
          map((response) => unwrap(response, '取得節慶關聯度失敗')),
          tap((affinities) => this.affinities.set(affinities)),
        ),
      this.affinityError,
    );
  }

  saveAffinities(
    productId: number,
    affinities: readonly Pick<ProductFestivalAffinity, 'festivalCode' | 'affinity'>[],
  ): Observable<readonly ProductFestivalAffinity[]> {
    return this.track(
      this.http
        .put<ApiResponse<ProductFestivalAffinity[]>>(
          `${this.baseUrl}/products/${productId}/festival-affinity`,
          { affinities },
        )
        .pipe(
          map((response) => unwrap(response, '儲存節慶關聯度失敗')),
          tap((saved) => this.affinities.set(saved)),
        ),
    );
  }

  loadReviewSummary(productId: number): Observable<ProductReviewSummary> {
    this.reviewSummaryError.set(null);
    return this.track(
      this.http
        .get<ApiResponse<ProductReviewSummary>>(
          `${this.baseUrl}/products/${productId}/comments-file`,
        )
        .pipe(
          map((response) => unwrap(response, '取得評論摘要失敗')),
          tap((summary) => this.reviewSummary.set(summary)),
        ),
      this.reviewSummaryError,
    );
  }

  uploadReviewFile(productId: number, file: File): Observable<ProductReviewFileUploadResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.track(
      this.http
        .post<ApiResponse<ProductReviewFileUploadResult>>(
          `${this.baseUrl}/products/${productId}/comments-file`,
          formData,
        )
        .pipe(
          map((response) => unwrap(response, '上傳評論 CSV 失敗')),
          tap((result) => {
            this.reviewUploadResult.set(result);
            this.reviewSummary.set({
              totalReviewCount: result.totalReviewCount,
              lowConfidence: result.lowConfidence,
            });
          }),
        ),
    );
  }

  clear(): void {
    this.affinities.set([]);
    this.reviewUploadResult.set(null);
    this.reviewSummary.set(null);
    this.error.set(null);
    this.festivalError.set(null);
    this.affinityError.set(null);
    this.reviewSummaryError.set(null);
  }

  private track<T>(
    source: Observable<T>,
    errorTarget: WritableSignal<string | null> = this.error,
  ): Observable<T> {
    return defer(() => {
      this.pendingOperations.update((count) => count + 1);
      errorTarget.set(null);
      return source.pipe(
        catchError((error: unknown) => {
          errorTarget.set(toErrorMessage(error));
          return throwError(() => error);
        }),
        finalize(() => this.pendingOperations.update((count) => Math.max(0, count - 1))),
      );
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
  return error instanceof Error ? error.message : '品項補充資料處理失敗';
}
