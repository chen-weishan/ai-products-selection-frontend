import { Injectable, inject } from '@angular/core';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import { HttpClient, HttpParams, HttpContext } from '@angular/common/http';
import { Observable, throwError, map } from 'rxjs';
import {
  RiskAlertItem,
  RiskSummary,
  RiskRulesResponse,
  RiskListResponse,
  RiskFilterState,
  RiskRuleItem,
} from './risk.model';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string };
}

export interface RuleUpdateResult {
  recalculationStarted?: boolean;
}

/** Never substitute sample data or a successful result for a failed API request. */
@Injectable({ providedIn: 'root' })
export class RiskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/risks';
  private readonly localLoading = { context: new HttpContext().set(SKIP_GLOBAL_LOADING, true) };

  private unwrap<T>(response: ApiResponse<T> | T): T {
    const envelope = response as ApiResponse<T>;
    if (envelope?.success === false) {
      throw new Error(envelope.error?.message || '風險服務未完成此操作。');
    }
    return envelope && Object.prototype.hasOwnProperty.call(envelope, 'data')
      ? (envelope.data as T)
      : (response as T);
  }

  getRisks(filters: RiskFilterState, page = 0, size = 10): Observable<RiskListResponse> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters.status !== 'ALL') params = params.set('status', filters.status);
    if (filters.severity !== 'ALL') params = params.set('severity', filters.severity);
    if (filters.riskType !== 'ALL') params = params.set('type', filters.riskType);
    if (filters.categoryId !== 'ALL') params = params.set('categoryId', filters.categoryId);
    const keyword = filters.keyword?.trim();
    if (keyword) params = params.set('keyword', keyword);
    return this.http
      .get<ApiResponse<RiskListResponse>>(this.baseUrl, { params, ...this.localLoading })
      .pipe(
        map((response) => {
          const result = this.unwrap(response);
          if (!Array.isArray(result?.content) || !Number.isFinite(result.totalElements)) {
            throw new Error('風險清單回應格式不完整，請重試。');
          }
          return result;
        }),
      );
  }

  getRiskSummary(): Observable<RiskSummary> {
    return this.http
      .get<ApiResponse<RiskSummary>>(`${this.baseUrl}/summary`, this.localLoading)
      .pipe(
        map((response) => {
          const raw = this.unwrap(response) as RiskSummary & {
            highOpen?: number;
            mediumOpen?: number;
            lowOpen?: number;
            handledThisMonth?: number;
          };
          const result: RiskSummary = {
            ...raw,
            highRiskCount: raw.highOpen ?? raw.highRiskCount,
            mediumRiskCount: raw.mediumOpen ?? raw.mediumRiskCount,
            lowRiskCount: raw.lowOpen ?? raw.lowRiskCount,
            monthlyHandledCount: raw.handledThisMonth ?? raw.monthlyHandledCount,
          };
          if (
            !result ||
            [
              result.highRiskCount,
              result.mediumRiskCount,
              result.lowRiskCount,
              result.monthlyHandledCount,
            ].some((value) => !Number.isFinite(value))
          ) {
            throw new Error('示警統計回應格式不完整，請重試。');
          }
          return result;
        }),
      );
  }

  acknowledgeRisk(id: number): Observable<RiskAlertItem> {
    return this.http
      .patch<ApiResponse<RiskAlertItem>>(`${this.baseUrl}/${id}/acknowledge`, {}, this.localLoading)
      .pipe(map((response) => this.unwrap(response)));
  }

  ignoreRisk(id: number, reason: string): Observable<RiskAlertItem> {
    const trimmed = reason.trim();
    if (!trimmed) return throwError(() => new Error('忽略理由為必填項目'));
    if (trimmed.length > 300) return throwError(() => new Error('忽略理由不可超過 300 字'));
    return this.http
      .patch<ApiResponse<RiskAlertItem>>(
        `${this.baseUrl}/${id}/ignore`,
        { reason: trimmed },
        this.localLoading,
      )
      .pipe(map((response) => this.unwrap(response)));
  }

  getRiskRules(): Observable<RiskRulesResponse> {
    return this.http
      .get<ApiResponse<RiskRulesResponse>>(`${this.baseUrl}/rules`, this.localLoading)
      .pipe(
        map((response) => {
          const result = this.unwrap(response);
          if (
            !Array.isArray(result?.rules) ||
            typeof result.recalculation?.running !== 'boolean' ||
            !Number.isFinite(result.recalculation.progressPercent)
          ) {
            throw new Error('規則或重算進度回應格式不完整，請重試。');
          }
          return {
            ...result,
            rules: result.rules.map((rule) => {
              const threshold =
                typeof rule.thresholdJson === 'string'
                  ? JSON.parse(rule.thresholdJson)
                  : rule.thresholdJson;
              if (!threshold || typeof threshold !== 'object' || Array.isArray(threshold))
                throw new Error('規則門檻格式不正確');
              return { ...rule, thresholdJson: threshold };
            }),
            recalculation: {
              ...result.recalculation,
              errorMessage: result.recalculation.lastError ?? result.recalculation.errorMessage,
              status: result.recalculation.lastError ? 'FAILED' : result.recalculation.status,
            },
          };
        }),
      );
  }

  updateRuleThreshold(
    ruleCode: string,
    thresholdJson: Record<string, unknown>,
    categoryId?: number | null,
    maxPenalty?: number,
  ): Observable<RuleUpdateResult> {
    return this.http
      .put<ApiResponse<RuleUpdateResult>>(
        `${this.baseUrl}/rules/${encodeURIComponent(ruleCode)}`,
        {
          threshold: thresholdJson,
          categoryId: categoryId ?? null,
          ...(maxPenalty == null ? {} : { maxPenalty }),
        },
        this.localLoading,
      )
      .pipe(map((response) => this.unwrap(response)));
  }
}
