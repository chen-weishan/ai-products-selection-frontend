import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  ApiResponse,
  ApproveWeightVersionRequest,
  CreateWeightVersionRequest,
  PageResponse,
  WeightVersionDetail,
  WeightVersionSummary,
} from '../../core/models/weight';

/**
 * FR-08 權重版本 API（規格書 §8.2）。
 *
 * 路徑走相對路徑 /api/v1，由 proxy.conf.json 轉到 localhost:8080，
 * 因此瀏覽器視為同源，不觸發 CORS。
 *
 * TODO FR-01 完成後改用 AuthService 的 JWT：後端目前是 Boot 預設的 HTTP Basic，
 * 帳密固定在 application-dev.properties（dev profile 專用）。
 */
@Injectable({ providedIn: 'root' })
export class WeightVersionService {
  private http = inject(HttpClient);

  private readonly baseUrl = '/api/v1/weight-versions';

  private readonly authHeaders = new HttpHeaders({
    Authorization: 'Basic ' + btoa('dev:dev1234'),
  });

  /** 版本清單。後端預設排序為 createdAt desc。 */
  list(page = 0, size = 20): Observable<PageResponse<WeightVersionSummary>> {
    return this.http
      .get<ApiResponse<PageResponse<WeightVersionSummary>>>(
        `${this.baseUrl}?page=${page}&size=${size}`,
        { headers: this.authHeaders },
      )
      .pipe(map((res) => res.data));
  }

  /** 目前生效中的版本（is_current = true）。查無回 404。 */
  getActive(): Observable<WeightVersionDetail> {
    return this.http
      .get<ApiResponse<WeightVersionDetail>>(`${this.baseUrl}/active`, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.data));
  }

  /** 指定版本的四組權重與四榜門檻。 */
  getDetail(id: number): Observable<WeightVersionDetail> {
    return this.http
      .get<ApiResponse<WeightVersionDetail>>(`${this.baseUrl}/${id}/profiles`, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.data));
  }

  /** 建立草稿。成功回 201。 */
  create(body: CreateWeightVersionRequest): Observable<WeightVersionDetail> {
    return this.http
      .post<ApiResponse<WeightVersionDetail>>(this.baseUrl, body, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.data));
  }

  /** 編輯草稿。已核准的版本會回 409。 */
  update(id: number, body: CreateWeightVersionRequest): Observable<WeightVersionDetail> {
    return this.http
      .put<ApiResponse<WeightVersionDetail>>(`${this.baseUrl}/${id}`, body, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.data));
  }

  /** 核准生效。會把原本生效中的版本退為 RETIRED。 */
  approve(id: number, body: ApproveWeightVersionRequest): Observable<WeightVersionDetail> {
    return this.http
      .post<ApiResponse<WeightVersionDetail>>(`${this.baseUrl}/${id}/approve`, body, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.data));
  }
}
