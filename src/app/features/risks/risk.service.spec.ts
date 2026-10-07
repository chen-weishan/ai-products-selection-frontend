import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { RiskService } from './risk.service';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import { RiskFilterState } from './risk.model';
import { Observable } from 'rxjs';

describe('RiskService', () => {
  let service: RiskService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RiskService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RiskService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch risks list from backend', () => {
    const filters: RiskFilterState = {
      status: 'ALL',
      severity: 'ALL',
      riskType: 'ALL',
      categoryId: 'ALL',
      keyword: '',
    };

    service.getRisks(filters, 0, 10).subscribe((res) => {
      expect(res).toBeTruthy();
      expect(res.content.length).toBeGreaterThan(0);
      expect(res.page).toBe(0);
      expect(res.size).toBe(10);
    });

    const req = httpTesting.expectOne((r) => r.url.startsWith('/api/v1/risks'));
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');

    // 回傳正常後端資料結構
    req.flush({
      data: {
        content: [
          {
            id: 1,
            productId: 101,
            productName: '測試衝鋒衣',
            categoryId: 1,
            categoryName: '服飾',
            riskType: 'REVIEW_RISK',
            severity: 'HIGH',
            triggerValue: '負評 20%',
            impact: '扣分 15',
            detectedAt: new Date().toISOString(),
            status: 'OPEN',
          },
        ],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
      },
    });
  });

  it('should fetch risk summary KPIs', () => {
    service.getRiskSummary().subscribe((summary) => {
      expect(summary.highRiskCount).toBe(5);
      expect(summary.mediumRiskCount).toBe(3);
      expect(summary.lowRiskCount).toBe(2);
      expect(summary.monthlyHandledCount).toBe(10);
    });

    const req = httpTesting.expectOne('/api/v1/risks/summary');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    req.flush({
      data: {
        highOpen: 5,
        mediumOpen: 3,
        lowOpen: 2,
        handledThisMonth: 10,
        lastDetectedAt: '2026-10-06T10:00:00Z',
      },
    });
  });

  it('parses backend JSON rule strings and exposes recalculation failures', () => {
    service.getRiskRules().subscribe((res) => {
      expect(res.rules[0].thresholdJson).toEqual({ confidenceThreshold: 50 });
      expect(res.recalculation.status).toBe('FAILED');
    });
    httpTesting.expectOne('/api/v1/risks/rules').flush({
      data: {
        rules: [
          {
            ruleCode: 'LOW_CONFIDENCE',
            categoryId: 7,
            thresholdJson: '{"confidenceThreshold":50}',
            enabled: true,
          },
        ],
        recalculation: { running: false, progressPercent: 100, lastError: 'season scan failed' },
      },
    });
  });

  it('sends category scope and penalty with rule updates', () => {
    service.updateRuleThreshold('REVIEW_RISK', { negativeRateThreshold: 0.2 }, 7, 20).subscribe();
    const req = httpTesting.expectOne('/api/v1/risks/rules/REVIEW_RISK');
    expect(req.request.body).toEqual({
      threshold: { negativeRateThreshold: 0.2 },
      categoryId: 7,
      maxPenalty: 20,
    });
    req.flush({ data: { rules: [], recalculation: { running: false, progressPercent: 100 } } });
  });

  it('should acknowledge risk alert', () => {
    service.acknowledgeRisk(101).subscribe((res) => {
      expect(res.status).toBe('ACKNOWLEDGED');
    });

    const req = httpTesting.expectOne('/api/v1/risks/101/acknowledge');
    expect(req.request.method).toBe('PATCH');
    req.flush({
      data: {
        id: 101,
        productId: 1001,
        productName: '測試衝鋒衣',
        riskType: 'REVIEW_RISK',
        severity: 'HIGH',
        triggerValue: '負評 18%',
        detectedAt: '2026-10-06T10:00:00Z',
        status: 'ACKNOWLEDGED',
        handledAt: '2026-10-06T12:00:00Z',
        handledBy: '王採購',
      },
    });
  });

  it('should ignore risk alert with reason and reject blank or overlength reasons', () => {
    // 1. 測試理由為空
    service.ignoreRisk(101, '').subscribe({
      error: (err) => {
        expect(err.message).toContain('忽略理由為必填項目');
      },
    });

    // 2. 測試正常忽略
    service.ignoreRisk(101, '已向供應商確認換批次出貨').subscribe((res) => {
      expect(res.status).toBe('IGNORED');
      expect(res.ignoreReason).toBe('已向供應商確認換批次出貨');
    });

    const req = httpTesting.expectOne('/api/v1/risks/101/ignore');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ reason: '已向供應商確認換批次出貨' });
    req.flush({
      data: {
        id: 101,
        productId: 1001,
        productName: '測試衝鋒衣',
        riskType: 'REVIEW_RISK',
        severity: 'HIGH',
        triggerValue: '負評 18%',
        detectedAt: '2026-10-06T10:00:00Z',
        status: 'IGNORED',
        ignoreReason: '已向供應商確認換批次出貨',
        handledAt: '2026-10-06T12:00:00Z',
        handledBy: '王採購',
      },
    });
  });

  it('should fetch risk rules and recalculation status', () => {
    service.getRiskRules().subscribe((res) => {
      expect(res.rules.length).toBeGreaterThan(0);
      expect(res.recalculation.running).toBe(false);
    });

    const req = httpTesting.expectOne('/api/v1/risks/rules');
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    req.flush({
      data: {
        rules: [
          {
            ruleCode: 'REVIEW_RISK',
            ruleName: '負評風險',
            enabled: true,
            thresholdJson: { negativeRateThreshold: 0.15 },
          },
        ],
        recalculation: {
          running: false,
          progressPercent: 100,
        },
      },
    });
  });

  it('should update rule threshold (SYS_ADMIN)', () => {
    service.updateRuleThreshold('REVIEW_RISK', { negativeRateThreshold: 0.2 }).subscribe((res) => {
      expect(res).toBeTruthy();
    });

    const req = httpTesting.expectOne('/api/v1/risks/rules/REVIEW_RISK');
    expect(req.request.method).toBe('PUT');
    expect(req.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    expect(req.request.body).toEqual({
      threshold: { negativeRateThreshold: 0.2 },
      categoryId: null,
    });
    req.flush({ success: true });
  });

  it('sends the keyword together with all filters and pagination', () => {
    service
      .getRisks(
        {
          status: 'OPEN',
          severity: 'HIGH',
          riskType: 'REVIEW_RISK',
          categoryId: 7,
          keyword: '  衝鋒衣  ',
        },
        2,
        20,
      )
      .subscribe();
    const req = httpTesting.expectOne((request) => request.url === '/api/v1/risks');
    expect(req.request.params.get('keyword')).toBe('衝鋒衣');
    expect(req.request.params.get('status')).toBe('OPEN');
    expect(req.request.params.get('severity')).toBe('HIGH');
    expect(req.request.params.get('type')).toBe('REVIEW_RISK');
    expect(req.request.params.get('categoryId')).toBe('7');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush({ data: { content: [], page: 2, size: 20, totalElements: 0, totalPages: 0 } });
  });

  const requests: [string, (service: RiskService) => Observable<unknown>][] = [
    [
      '/api/v1/risks',
      (service) =>
        service.getRisks({ status: 'ALL', severity: 'ALL', riskType: 'ALL', categoryId: 'ALL' }),
    ],
    ['/api/v1/risks/summary', (service) => service.getRiskSummary()],
    ['/api/v1/risks/101/acknowledge', (service) => service.acknowledgeRisk(101)],
    ['/api/v1/risks/101/ignore', (service) => service.ignoreRisk(101, '已評估')],
    ['/api/v1/risks/rules', (service) => service.getRiskRules()],
    [
      '/api/v1/risks/rules/REVIEW_RISK',
      (service) => service.updateRuleThreshold('REVIEW_RISK', { negativeRateThreshold: 0.2 }),
    ],
  ];

  it.each([401, 403, 404, 409, 500])(
    'propagates HTTP %i on every endpoint without sample data or success',
    (status) => {
      for (const [url, request] of requests) {
        let failed = false;
        request(service).subscribe({
          next: () => {
            throw new Error('Failed API request was presented as successful');
          },
          error: (error) => {
            failed = true;
            expect(error.status).toBe(status);
          },
        });
        httpTesting
          .expectOne((req) => req.url === url)
          .flush({ error: 'failed' }, { status, statusText: 'Failed' });
        expect(failed).toBe(true);
      }
    },
  );

  it('propagates network failures without substituting a successful result', () => {
    for (const [url, request] of requests) {
      let failed = false;
      request(service).subscribe({
        next: () => {
          throw new Error('Network failure was presented as successful');
        },
        error: (error) => {
          failed = true;
          expect(error.status).toBe(0);
        },
      });
      httpTesting.expectOne((req) => req.url === url).error(new ProgressEvent('error'));
      expect(failed).toBe(true);
    }
  });

  it('rejects an unsuccessful application envelope even when HTTP returns 200', () => {
    let message = '';
    service.updateRuleThreshold('REVIEW_RISK', { negativeRateThreshold: 0.2 }).subscribe({
      next: () => {
        throw new Error('Rejected update was presented as successful');
      },
      error: (error) => {
        message = error.message;
      },
    });
    httpTesting
      .expectOne('/api/v1/risks/rules/REVIEW_RISK')
      .flush({ success: false, error: { message: '無法儲存' }, data: null });
    expect(message).toBe('無法儲存');
  });

  it('rejects incomplete progress instead of interpreting it as finished', () => {
    let failed = false;
    service.getRiskRules().subscribe({
      error: () => {
        failed = true;
      },
    });
    httpTesting.expectOne('/api/v1/risks/rules').flush({ data: { rules: [] } });
    expect(failed).toBe(true);
  });

  it('rejects blank and overlength ignore reasons before sending a request', () => {
    for (const reason of ['   ', '字'.repeat(301)]) {
      let failed = false;
      service.ignoreRisk(1, reason).subscribe({
        error: () => {
          failed = true;
        },
      });
      expect(failed).toBe(true);
    }
    httpTesting.expectNone('/api/v1/risks/1/ignore');
  });
});
