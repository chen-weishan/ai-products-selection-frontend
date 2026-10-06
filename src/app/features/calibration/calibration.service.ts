import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, PageResponse } from '../../core/models/weight';
import {
  BacktestComparison,
  CalibrationReport,
  GenerateCalibrationReportResult,
  ReviewCalibrationRequest,
} from '../../core/models/calibration';

/**
 * FR-15 權重校準 API（規格書 §8「校準」、畫面 S-19）。手寫理由同 DecisionService。
 * AI 解讀由後端在產生報告後自動排入；單獨觸發的端點（POST /calibration/reports/{id}/interpretation）屬 Agent 7。
 */
@Injectable({ providedIn: 'root' })
export class CalibrationService {
  private http = inject(HttpClient);

  list(page = 0, size = 8): Observable<PageResponse<CalibrationReport>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http
      .get<ApiResponse<PageResponse<CalibrationReport>>>('/api/v1/calibration/reports', { params })
      .pipe(map((res) => res.data));
  }

  /** 尚未產生任何報告時為 null。 */
  latest(): Observable<CalibrationReport | null> {
    return this.http
      .get<ApiResponse<CalibrationReport | null>>('/api/v1/calibration/reports/latest')
      .pipe(map((res) => res.data));
  }

  /**
   * 規格外端點（設計決定）：立即產生或重算待審核的季度報告，供 demo／補跑。
   * 後端會自動建立 Agent 7 解讀任務（重算會清空舊解讀）。
   */
  generate(quarter: string): Observable<GenerateCalibrationReportResult> {
    const params = new HttpParams().set('quarter', quarter);
    return this.http
      .post<ApiResponse<GenerateCalibrationReportResult>>('/api/v1/calibration/reports', null, { params })
      .pipe(map((res) => res.data));
  }

  review(id: number, body: ReviewCalibrationRequest): Observable<CalibrationReport> {
    return this.http
      .post<ApiResponse<CalibrationReport>>(`/api/v1/calibration/reports/${id}/approve`, body)
      .pipe(map((res) => res.data));
  }

  backtest(versionAId: number, versionBId: number): Observable<BacktestComparison> {
    return this.http
      .post<ApiResponse<BacktestComparison>>('/api/v1/calibration/backtest', { versionAId, versionBId })
      .pipe(map((res) => res.data));
  }
}
