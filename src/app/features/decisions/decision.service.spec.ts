import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DecisionService } from './decision.service';

/**
 * FR-11 API 的請求形狀（規格書 §8.2「決策與回饋」）。
 * 驗 URL、query、body 與封套剝除；這些錯了畫面只會靜靜地空白。
 */
describe('DecisionService', () => {
  let service: DecisionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DecisionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('清單只送有值的篩選條件；null 的條件不出現在 query', () => {
    service.list({ decision: 'ADOPT', pendingResult: true, decidedBy: null, page: 0, size: 20 }).subscribe();

    const req = http.expectOne((r) => r.url === '/api/v1/decisions');
    expect(req.request.params.get('decision')).toBe('ADOPT');
    expect(req.request.params.get('pendingResult')).toBe('true');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.has('decidedBy')).toBe(false);
    req.flush({ success: true, data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
  });

  it('準確度可依區間、類別、決策者篩選（AC-11-4）', () => {
    service.accuracy({ from: '2026-07-01', to: null, categoryId: 3, decidedBy: 1 }).subscribe();

    const req = http.expectOne((r) => r.url === '/api/v1/decisions/accuracy');
    expect(req.request.params.get('from')).toBe('2026-07-01');
    expect(req.request.params.has('to')).toBe(false);
    expect(req.request.params.get('categoryId')).toBe('3');
    expect(req.request.params.get('decidedBy')).toBe('1');
    req.flush({ success: true, data: {} });
  });

  it('建立決策打 POST /products/{id}/decisions，回應剝出 data', () => {
    let createdId: number | undefined;
    service
      .create(112, { decision: 'ADOPT', firstOrderQty: 120, expectedListDate: null, reason: null })
      .subscribe((d) => (createdId = d.id));

    const req = http.expectOne('/api/v1/products/112/decisions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'ADOPT', firstOrderQty: 120, expectedListDate: null, reason: null });
    req.flush({ success: true, data: { id: 92 } });
    expect(createdId).toBe(92);
  });

  it('結案送 campaignEndDate；省略時送 null 由後端取今日', () => {
    service.close(92, null).subscribe();
    const req = http.expectOne('/api/v1/decisions/92/close');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ campaignEndDate: null });
    req.flush({ success: true, data: {} });
  });

  it('回填打 POST /decisions/{id}/result', () => {
    service
      .fillResult(92, {
        actualQty: 138,
        selloutStatus: 'ON_TIME',
        returnRate: 0.012,
        realizedMarginRate: 0.386,
        postNoteCode: null,
        postNoteText: null,
      })
      .subscribe();
    const req = http.expectOne('/api/v1/decisions/92/result');
    expect(req.request.body.realizedMarginRate).toBe(0.386);
    req.flush({ success: true, data: {} });
  });

  it('開團沿用 FR-03 的 PATCH /products/{id}/status，目標 LISTED', () => {
    service.markListed(112).subscribe();
    const req = http.expectOne('/api/v1/products/112/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ targetStatus: 'LISTED' });
    req.flush({ success: true, data: {} });
  });

  it('建立決策表單的品項搜尋只找 A 軌、指定狀態', () => {
    service.searchProducts('', 'WATCHING').subscribe();
    const req = http.expectOne((r) => r.url === '/api/v1/products');
    expect(req.request.params.get('trackType')).toBe('A');
    expect(req.request.params.get('status')).toBe('WATCHING');
    expect(req.request.params.has('keyword')).toBe(false);
    // 後端 size 只接受 20／50／100
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ success: true, data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
  });

  it('品類樹攤平成「父類／子類」單層清單', () => {
    let result: { id: number; name: string }[] = [];
    service.categories().subscribe((list) => (result = list));
    http.expectOne('/api/v1/categories').flush({
      success: true,
      data: [{ id: 1, name: '食品', children: [{ id: 2, name: '零食', children: [] }] }],
    });
    expect(result).toEqual([
      { id: 1, name: '食品' },
      { id: 2, name: '食品／零食' },
    ]);
  });
});
