import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';

export type SourcingQueueFilter =
  | 'ALL'
  | 'ACTIVE'
  | 'URGENT'
  | 'SOURCING'
  | 'PENDING'
  | 'PROMOTED'
  | 'REJECTED';

export interface SourcingQueueRow {
  productId: number;
  keyword: string;
  heatStage?: string | null;
  stageWeeks?: number | null;
  estimatedLifespanDays?: number | null;
  leadTimeDays?: number | null;
  timeGapDays?: number | null;
  sourcingStatus: string;
}

export interface SourcingQueuePage {
  content: SourcingQueueRow[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  summary: {
    activeCount: number;
    rejectedCount: number;
    promotedCount: number;
  };
}

interface ApiResponse<T> {
  data: T;
}

@Injectable({ providedIn: 'root' })
export class SourcingQueueService {
  private static readonly MAX_CACHE_ENTRIES = 30;

  private readonly http = inject(HttpClient);
  private readonly pageCache = new Map<string, Observable<SourcingQueuePage>>();

  getQueue(
    status: SourcingQueueFilter,
    page: number,
    size: number,
    skipGlobalLoading = false,
  ): Observable<SourcingQueuePage> {
    const cacheKey = `${status}:${page}:${size}`;
    const cached = this.pageCache.get(cacheKey);
    if (cached) return cached;

    const params = new HttpParams()
      .set('status', status)
      .set('page', page)
      .set('size', size);
    const request = this.http
      .get<ApiResponse<SourcingQueuePage>>('/api/v1/sourcing/queue', {
        params,
        context: new HttpContext().set(SKIP_GLOBAL_LOADING, skipGlobalLoading),
      })
      .pipe(
        map((response) => response.data),
        catchError((error) => {
          this.pageCache.delete(cacheKey);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.pageCache.set(cacheKey, request);
    if (this.pageCache.size > SourcingQueueService.MAX_CACHE_ENTRIES) {
      const oldestKey = this.pageCache.keys().next().value;
      if (oldestKey) this.pageCache.delete(oldestKey);
    }
    return request;
  }

  invalidateCache(): void {
    this.pageCache.clear();
  }
}
