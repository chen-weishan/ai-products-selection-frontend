import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  AccuracySearch,
  ApiResponse,
  CampaignResultRequest,
  CreateDecisionRequest,
  Decision,
  DecisionAccuracy,
  DecisionContext,
  DecisionSearch,
  DecisionSnapshot,
  PageResponse,
  ProductOption,
  ProductStatus,
} from '../../core/models/decision';

/**
 * FR-11 採購決策與回饋閉環 API（規格書 §8.2「決策與回饋」、畫面 S-12）。
 *
 * 與 FestivalService 相同走相對路徑 /api/v1（proxy 轉到 localhost:8080），
 * 認證標頭由全域 interceptor 掛上。手寫而非用 openapi-generator 產生：
 * generate:api 會整包重產 src/app/api，dev 的 openapi.json 與後端 dev 不同步，重產會連帶弄壞其他頁。
 */
@Injectable({ providedIn: 'root' })
export class DecisionService {
  private http = inject(HttpClient);

  list(search: DecisionSearch): Observable<PageResponse<Decision>> {
    return this.http
      .get<ApiResponse<PageResponse<Decision>>>('/api/v1/decisions', { params: toParams(search) })
      .pipe(map((res) => res.data));
  }

  get(id: number): Observable<Decision> {
    return this.http.get<ApiResponse<Decision>>(`/api/v1/decisions/${id}`).pipe(map((res) => res.data));
  }

  snapshot(id: number): Observable<DecisionSnapshot> {
    return this.http
      .get<ApiResponse<DecisionSnapshot>>(`/api/v1/decisions/${id}/snapshot`)
      .pipe(map((res) => res.data));
  }

  /** AC-11-4：可依時間區間、類別、決策者篩選。 */
  accuracy(search: AccuracySearch): Observable<DecisionAccuracy> {
    return this.http
      .get<ApiResponse<DecisionAccuracy>>('/api/v1/decisions/accuracy', { params: toParams(search) })
      .pipe(map((res) => res.data));
  }

  /** 規格補充端點：建立前會綁哪筆評分、AI 建議、§7.4 目前可選的決策。 */
  context(productId: number): Observable<DecisionContext> {
    return this.http
      .get<ApiResponse<DecisionContext>>(`/api/v1/products/${productId}/decision-context`)
      .pipe(map((res) => res.data));
  }

  create(productId: number, body: CreateDecisionRequest): Observable<Decision> {
    return this.http
      .post<ApiResponse<Decision>>(`/api/v1/products/${productId}/decisions`, body)
      .pipe(map((res) => res.data));
  }

  /** 省略日期＝今日（後端以 Asia/Taipei 判定）。 */
  close(id: number, campaignEndDate: string | null): Observable<Decision> {
    return this.http
      .post<ApiResponse<Decision>>(`/api/v1/decisions/${id}/close`, { campaignEndDate })
      .pipe(map((res) => res.data));
  }

  fillResult(id: number, body: CampaignResultRequest): Observable<Decision> {
    return this.http
      .post<ApiResponse<Decision>>(`/api/v1/decisions/${id}/result`, body)
      .pipe(map((res) => res.data));
  }

  review(id: number): Observable<Decision> {
    return this.http
      .post<ApiResponse<Decision>>(`/api/v1/decisions/${id}/review`, {})
      .pipe(map((res) => res.data));
  }

  /**
   * 開團＝§7.4 品項 ADOPTED → LISTED。沿用 FR-03 既有端點 PATCH /products/{id}/status，
   * 不在決策模組另開一支。
   */
  markListed(productId: number): Observable<void> {
    return this.http
      .patch<ApiResponse<unknown>>(`/api/v1/products/${productId}/status`, { targetStatus: 'LISTED' })
      .pipe(map(() => undefined));
  }

  /** 建立決策表單的品項搜尋。只列 A 軌、指定狀態（§7.4 只有 EVALUATING／WATCHING 可建立決策）。 */
  searchProducts(keyword: string, status: ProductStatus): Observable<ProductOption[]> {
    const params = toParams({ keyword: keyword || null, status, trackType: 'A', size: 20 });
    return this.http
      .get<ApiResponse<PageResponse<ProductOption>>>('/api/v1/products', { params })
      .pipe(map((res) => res.data.content));
  }

  /** 準確度篩選的品類下拉。後端回品類樹，攤平成「父類／子類」的單層清單。 */
  categories(): Observable<{ id: number; name: string }[]> {
    return this.http
      .get<ApiResponse<CategoryNode[]>>('/api/v1/categories')
      .pipe(map((res) => flattenCategories(res.data)));
  }
}

interface CategoryNode {
  id: number;
  name: string;
  children?: CategoryNode[];
}

function flattenCategories(nodes: CategoryNode[], parent?: string): { id: number; name: string }[] {
  return nodes.flatMap((node) => {
    const name = parent ? `${parent}／${node.name}` : node.name;
    return [{ id: node.id, name }, ...flattenCategories(node.children ?? [], name)];
  });
}

/** null／undefined／空字串的參數不送，後端才會視為「不篩選」。 */
function toParams(values: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
