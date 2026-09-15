import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse, PageResponse, SceneType } from '../../core/models/weight';
import { ScoreDeductions, ScoreRankingRow, SimulateRequest } from '../../core/models/score';

/**
 * FR-04 選品分數 API（規格書 §8.2）。
 *
 * 路徑走相對路徑 /api/v1，由 proxy.conf.json 轉到 localhost:8080，
 * 因此瀏覽器視為同源，不觸發 CORS。
 *
 * TODO FR-01 完成後改用 AuthService 的 JWT：後端目前是 Boot 預設的 HTTP Basic，
 * 帳密固定在 application-dev.properties（dev profile 專用）。
 */
@Injectable({ providedIn: 'root' })
export class ScoreService {
  private http = inject(HttpClient);

  private readonly baseUrl = '/api/v1/scores';

  private readonly authHeaders = new HttpHeaders({
    Authorization: 'Basic ' + btoa('dev:dev1234'),
  });

  /**
   * 排行清單。scene／categoryId 省略時該條件不生效。
   * 查無資料回空頁（totalElements = 0），不是 404。
   */
  ranking(
    period: string,
    scene: SceneType | null,
    categoryId: number | null,
    page = 0,
    size = 20,
  ): Observable<PageResponse<ScoreRankingRow>> {
    let params = new HttpParams().set('period', period).set('page', page).set('size', size);
    if (scene) params = params.set('scene', scene);
    if (categoryId != null) params = params.set('categoryId', categoryId);

    return this.http
      .get<ApiResponse<PageResponse<ScoreRankingRow>>>(`${this.baseUrl}/ranking`, {
        headers: this.authHeaders,
        params,
      })
      .pipe(map((res) => res.data));
  }

  /** 某一列的扣分明細。點列展開時才打。 */
  deductions(scoreId: number): Observable<ScoreDeductions> {
    return this.http
      .get<ApiResponse<ScoreDeductions>>(`${this.baseUrl}/${scoreId}/deductions`, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.data));
  }

  /** 以草稿權重版本重算排行。不寫入資料庫，回的是清單不是分頁。 */
  simulate(body: SimulateRequest): Observable<ScoreRankingRow[]> {
    return this.http
      .post<ApiResponse<ScoreRankingRow[]>>(`${this.baseUrl}/simulate`, body, {
        headers: this.authHeaders,
      })
      .pipe(map((res) => res.data));
  }
}
