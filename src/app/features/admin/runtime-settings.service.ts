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
