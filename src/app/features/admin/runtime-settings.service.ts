import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ModelRoute {
  primary: string;
  fallbacks: string[];
}

export interface AiRuntimeConfig {
  models: Record<string, ModelRoute>;
  dailyQuota: number;
  trackAShare: number;
  trackBShare: number;
  retryShare: number;
  warningRatio: number;
  rateLimitPerMinute: number;
  trendRateLimitPerMinute: number;
  batchItemCap: number;
  retryMax: number;
  timeoutSeconds: number;
  sourcingTimeoutSeconds: number;
  cacheDays: number;
  trendCacheDays: number;
  sourcingCacheDays: number;
}

export interface RuntimeSchedule {
  code: string;
  label: string;
  cron: string;
  enabled: boolean;
}

export interface RuntimeScheduleConfig {
  items: RuntimeSchedule[];
}

export interface OperationalRuntimeConfig {
  loginMaxFailedAttempts: number;
  loginLockDurationMinutes: number;
  heatTagHalveAfterDays: number;
  heatTagExpireDays: number;
  scoringMinCategorySample: number;
  sceneAdoptConfidence: number;
  sceneScoringConfidence: number;
  calibrationMinSample: number;
}

/** §6.7.2 邏輯別名的中文名稱與使用者（後端提供，前端不寫死）。 */
export interface ModelAliasInfo {
  code: string;
  label: string;
  description: string;
  agents: string[];
}

export interface ModelOption {
  id: string;
  /** 出現在可用清單（Mistral 即時查詢或系統設定清單）。 */
  available: boolean;
  /** 目前設定中的主模型或備援模型。 */
  inUse: boolean;
}

export interface AiConfigOptions {
  aliases: ModelAliasInfo[];
  models: ModelOption[];
  /** MISTRAL_API＝向 Mistral 即時查得；CONFIGURED_LIST＝取自系統設定。 */
  source: string;
  warning: string | null;
}

export interface BudgetPoolSnapshot {
  pool: 'TRACK_A' | 'TRACK_B' | 'RETRY' | string;
  share: number;
  limit: number;
  used: number;
  cacheHits: number;
  status: 'OK' | 'WARNING' | 'EXHAUSTED' | string;
}

export interface BudgetSnapshot {
  dailyQuota: number;
  resetAt: string;
  resetSource: string;
  pools: BudgetPoolSnapshot[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { message?: string };
}

@Injectable({ providedIn: 'root' })
export class RuntimeSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/admin`;

  getAiConfig(): Observable<AiRuntimeConfig> {
    return this.http.get<ApiResponse<AiRuntimeConfig>>(`${this.baseUrl}/ai-config`)
      .pipe(this.unwrap('取得 AI 設定失敗'));
  }

  getAiConfigOptions(): Observable<AiConfigOptions> {
    return this.http.get<ApiResponse<AiConfigOptions>>(`${this.baseUrl}/ai-config/options`)
      .pipe(this.unwrap('取得模型清單失敗'));
  }

  getBudgets(): Observable<BudgetSnapshot> {
    return this.http.get<ApiResponse<BudgetSnapshot>>(`${environment.apiBaseUrl}/ai/budgets`)
      .pipe(this.unwrap('取得今日配額用量失敗'));
  }

  updateAiConfig(config: AiRuntimeConfig): Observable<AiRuntimeConfig> {
    return this.http.put<ApiResponse<AiRuntimeConfig>>(`${this.baseUrl}/ai-config`, config)
      .pipe(this.unwrap('儲存 AI 設定失敗'));
  }

  getSchedules(): Observable<RuntimeScheduleConfig> {
    return this.http.get<ApiResponse<RuntimeScheduleConfig>>(`${this.baseUrl}/schedules`)
      .pipe(this.unwrap('取得排程設定失敗'));
  }

  updateSchedules(config: RuntimeScheduleConfig): Observable<RuntimeScheduleConfig> {
    return this.http.put<ApiResponse<RuntimeScheduleConfig>>(`${this.baseUrl}/schedules`, config)
      .pipe(this.unwrap('儲存排程設定失敗'));
  }

  getOperationalConfig(): Observable<OperationalRuntimeConfig> {
    return this.http.get<ApiResponse<OperationalRuntimeConfig>>(`${this.baseUrl}/operational-config`)
      .pipe(this.unwrap('取得營運參數失敗'));
  }

  updateOperationalConfig(config: OperationalRuntimeConfig): Observable<OperationalRuntimeConfig> {
    return this.http.put<ApiResponse<OperationalRuntimeConfig>>(`${this.baseUrl}/operational-config`, config)
      .pipe(this.unwrap('儲存營運參數失敗'));
  }

  private unwrap<T>(fallback: string) {
    return (source: Observable<ApiResponse<T>>): Observable<T> => source.pipe(
      map((response) => {
        if (!response.success || response.data == null) {
          throw new Error(response.error?.message ?? fallback);
        }
        return response.data;
      }),
      catchError((error: unknown) => throwError(() => new Error(apiErrorMessage(error, fallback)))),
    );
  }
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = error.error?.error?.message;
    return typeof message === 'string' ? message : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
