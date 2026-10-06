import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TrendKeywordResponse } from '../../api';
import { environment } from '../../../environments/environment';

export interface TrendKeywordUsageProduct {
  id?: number;
  name?: string;
}

interface ApiEnvelope<T> {
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class TrendKeywordAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl || '/api/v1';

  getUsage(id: number): Observable<ApiEnvelope<{ products?: TrendKeywordUsageProduct[] }>> {
    return this.http.get<ApiEnvelope<{ products?: TrendKeywordUsageProduct[] }>>(
      `${this.baseUrl}/trends/keywords/${id}/usage`,
    );
  }

  updateEnabled(id: number, enabled: boolean): Observable<ApiEnvelope<TrendKeywordResponse>> {
    return this.http.put<ApiEnvelope<TrendKeywordResponse>>(
      `${this.baseUrl}/trends/keywords/${id}/enabled`,
      { enabled },
    );
  }
}
