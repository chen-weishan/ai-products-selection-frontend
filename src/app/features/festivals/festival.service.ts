import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  CategoryClimateProfile,
  CategoryLeadTime,
  CategoryProfile,
  ClimateNormal,
  Festival,
  FestivalCreateRequest,
  FestivalUpdateRequest,
} from '../../core/models/festival';

/**
 * FR-17 節慶檔期與氣候基準 API（規格書 §9、畫面 S-20）。
 *
 * 路徑走相對路徑 /api/v1，由 proxy.conf.json 轉到 localhost:8080，
 * 因此瀏覽器視為同源，不觸發 CORS。
 *
 * 後端 SecurityConfig 目前是 anyRequest().permitAll()，不需要送認證標頭。
 * TODO FR-01 收尾後改用 AuthService 的 JWT。
 */
@Injectable({ providedIn: 'root' })
export class FestivalService {
  private http = inject(HttpClient);

  /** 年度檔期，含關聯品類數與當前窗狀態。不帶 year 會變成下拉選項格式，故一律帶。 */
  listByYear(year: number): Observable<Festival[]> {
    return this.http
      .get<ApiResponse<Festival[]>>(`/api/v1/festivals?year=${year}`)
      .pipe(map((res) => res.data));
  }

  /** 新增檔期。LUNAR 只送 lunarMonth/lunarDay，國曆日期由後端換算（AC-17-1）。 */
  create(body: FestivalCreateRequest): Observable<Festival> {
    return this.http
      .post<ApiResponse<Festival>>('/api/v1/festivals', body)
      .pipe(map((res) => res.data));
  }

  update(id: number, body: FestivalUpdateRequest): Observable<Festival> {
    return this.http
      .put<ApiResponse<Festival>>(`/api/v1/festivals/${id}`, body)
      .pipe(map((res) => res.data));
  }

  /** 成功回 204，沒有 body。 */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`/api/v1/festivals/${id}`);
  }

  /**
   * S-20 標記 3、5 的現值（前置天數＋適溫區間），依品類 id 排序。
   *
   * 規格書 §9 只定義了兩支 PUT，這支 GET 是為了讓維護頁看得到目前設定而新增的。
   * 尚未設定的欄位回 null，前端顯示空白，不要用 0 代替。
   */
  categoryProfiles(): Observable<CategoryProfile[]> {
    return this.http
      .get<ApiResponse<CategoryProfile[]>>('/api/v1/categories/profiles')
      .pipe(map((res) => res.data));
  }

  /** AC-17-3：這份前置天數同時供 FR-16 時效落差使用，改這裡就是改那邊。 */
  updateLeadTime(categoryId: number, leadTimeDays: number): Observable<CategoryLeadTime> {
    return this.http
      .put<ApiResponse<CategoryLeadTime>>(`/api/v1/categories/${categoryId}/lead-time`, {
        leadTimeDays,
      })
      .pipe(map((res) => res.data));
  }

  /** tolerance 送 null 代表沿用系統預設（§FR-17-2 的 12°C）。 */
  updateClimateProfile(
    categoryId: number,
    body: { idealTempMin: number; idealTempMax: number; tolerance: number | null },
  ): Observable<CategoryClimateProfile> {
    return this.http
      .put<ApiResponse<CategoryClimateProfile>>(
        `/api/v1/categories/${categoryId}/climate-profile`,
        body,
      )
      .pipe(map((res) => res.data));
  }

  /** 歷史同期氣候統計。AC-17-4：這是唯一能進評分的氣候資料，短期預報不在此。 */
  climateNormals(region?: string): Observable<ClimateNormal[]> {
    const query = region ? `?region=${encodeURIComponent(region)}` : '';
    return this.http
      .get<ApiResponse<ClimateNormal[]>>(`/api/v1/climate-normals${query}`)
      .pipe(map((res) => res.data));
  }
}
