import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ScoreService } from './score.service';
import { ScoreRankingRow } from '../../core/models/score';

/**
 * FR-04 分數 API 的請求形狀（規格書 §8.2）。
 *
 * 驗的是「打出去的 URL、query、body 對不對」與「回應封套有沒有正確剝掉」，
 * 這兩件事錯了畫面會靜靜地空白，不會有錯誤訊息。
 */
describe('ScoreService', () => {
  let service: ScoreService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ScoreService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('排行帶上 period／page／size，scene 與 categoryId 省略時不出現在 query', () => {
    service.ranking('2026W30', null, null).subscribe();

    const req = http.expectOne(
      (r) => r.url === '/api/v1/scores/ranking' && r.params.get('period') === '2026W30',
    );
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('scene')).toBe(false);
    expect(req.request.params.has('categoryId')).toBe(false);
    req.flush({ success: true, data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
  });

  it('指定榜別時帶 scene', () => {
    service.ranking('2026W30', 'SEASONAL', 3, 1, 5).subscribe();

    const req = http.expectOne((r) => r.params.get('scene') === 'SEASONAL');
    expect(req.request.params.get('categoryId')).toBe('3');
    expect(req.request.params.get('page')).toBe('1');
    req.flush({ success: true, data: { content: [], page: 1, size: 5, totalElements: 0, totalPages: 0 } });
  });

  /** 後端統一封套是 { success, data }，服務要把 data 剝出來給元件。 */
  it('回應封套的 data 被剝出來', () => {
    const row = { scoreId: 1, penaltySubtotal: 4 } as ScoreRankingRow;
    let received: ScoreRankingRow[] | undefined;
    service.ranking('2026W30', 'VIRAL', null).subscribe((page) => (received = page.content));

    http.expectOne((r) => r.url === '/api/v1/scores/ranking').flush({
      success: true,
      data: { content: [row], page: 0, size: 20, totalElements: 1, totalPages: 1 },
    });

    expect(received).toEqual([row]);
  });

  it('扣分明細打 /scores/{id}/deductions', () => {
    service.deductions(42).subscribe();

    const req = http.expectOne('/api/v1/scores/42/deductions');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { scoreId: 42, penaltySubtotal: 0, riskSuppressed: false, items: [] } });
  });

  /** 試算是 POST，且回的是清單不是分頁（不寫入資料庫，沒有跨頁概念）。 */
  it('試算以 POST 送出 weightVersionId 與 period', () => {
    service.simulate({ weightVersionId: 3, period: '2026W30', scene: 'VIRAL', limit: 20 }).subscribe();

    const req = http.expectOne('/api/v1/scores/simulate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.weightVersionId).toBe(3);
    expect(req.request.body.period).toBe('2026W30');
    req.flush({ success: true, data: [] });
  });
});
