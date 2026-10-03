import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CalibrationComponent } from './calibration.component';
import { DialogService } from '../../services/dialog-service';
import { CalibrationReport } from '../../core/models/calibration';
import { FACTOR_CODES, SCENE_TYPES } from '../../core/models/weight';

/** 新格式報告：VIRAL 榜 TREND 0.50 → 0.57、MARGIN 0.10 → 0.05，其餘不動。 */
function report(overrides: Partial<CalibrationReport> = {}): CalibrationReport {
  const current = { TREND: 0.5, MARGIN: 0.1, CVR: 0.08, PRICE_FIT: 0.07, FESTIVAL: 0.15, CLIMATE: 0.1 };
  const viral = { ...current, TREND: 0.57, MARGIN: 0.05 };
  return {
    id: 7,
    quarter: '2026Q4',
    sampleSize: 38,
    minSample: 200,
    belowMinSample: true,
    validityWarning: '樣本數不足，統計上建議累積至 200 筆以上再進行權重調整。',
    status: 'PENDING',
    regression: {
      method: 'spearman-tilt',
      baseVersionId: 2,
      // 台北 2026-10-01 07:30；直接切 UTC 字串會誤顯示成 09-30
      generatedAt: '2026-09-30T23:30:00Z',
      factors: [],
      factorRows: FACTOR_CODES.map((code) => ({
        code,
        n: 38,
        correlation: 0.4,
        pValue: 0.01,
        sufficient: true,
        sceneType: 'VIRAL' as const,
        currentWeight: current[code],
        suggestedWeight: viral[code],
      })),
      scenes: SCENE_TYPES.map((sceneType) => ({
        sceneType,
        weights: FACTOR_CODES.map((code) => ({
          code,
          currentWeight: current[code],
          suggestedWeight: sceneType === 'VIRAL' ? viral[code] : current[code],
        })),
      })),
    },
    backtest: { backtests: [], schemes: [] },
    aiInterpretation: null,
    adjustmentAdvice: [],
    attentionNotes: [],
    aiModel: null,
    interpretedAt: null,
    acceptedFactors: [],
    reviewedBy: null,
    reviewedAt: null,
    weightVersionId: null,
    weightVersionNo: null,
    createdAt: '2026-09-30T23:30:00Z',
    ...overrides,
  };
}

describe('CalibrationComponent', () => {
  let component: CalibrationComponent;
  let fixture: ComponentFixture<CalibrationComponent>;
  let http: HttpTestingController;

  async function setup(latest: CalibrationReport | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [CalibrationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { Confirm: () => of(true) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CalibrationComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/calibration/reports').flush({
      success: true,
      data: { content: latest ? [latest] : [], page: 0, size: 8, totalElements: latest ? 1 : 0, totalPages: 1 },
    });
    http.expectOne('/api/v1/calibration/reports/latest').flush({ success: true, data: latest });
    http.match(() => true); // 權重版本清單不是本檔驗的對象
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('主畫面取 latest 報告', async () => {
    await setup(report());
    expect(component.report()?.id).toBe(7);
  });

  it('AC-15-1：樣本不足警示顯示且沒有關閉鈕', async () => {
    await setup(report());
    const alert = (fixture.nativeElement as HTMLElement).querySelector('.validity');
    expect(alert?.textContent).toContain('樣本數不足');
    expect(alert?.querySelector('button')).toBeNull();
  });

  it('時間以台北時區顯示', async () => {
    await setup(report());
    expect(text()).toContain('2026-10-01 07:30');
  });

  it('有調整的因子由四榜明細推得', async () => {
    await setup(report());
    expect([...component.changedFactors()].sort()).toEqual(['MARGIN', 'TREND']);
  });

  it('差異以百分點顯示', async () => {
    await setup(report());
    expect(component.diff({ currentWeight: 0.5, suggestedWeight: 0.57 })).toBe('＋7');
    expect(component.diff({ currentWeight: 0.1, suggestedWeight: 0.05 })).toBe('−5');
    expect(component.diff({ currentWeight: 0.1, suggestedWeight: 0.1 })).toBe('持平');
  });

  it('AC-15-5：部分採納只送出勾選的因子', async () => {
    await setup(report());
    component.startPartial();
    component.toggleAccepted('MARGIN', false);
    component.submit('PARTIAL');
    const req = http.expectOne('/api/v1/calibration/reports/7/approve');
    expect(req.request.body).toEqual({ action: 'PARTIAL', acceptedFactors: ['TREND'], comment: null });
    req.flush({ success: true, data: report({ status: 'PARTIAL', weightVersionNo: '2026Q4-cal', weightVersionId: 50 }) });
    fixture.detectChanges();
    expect(component.successMessage()).toContain('2026Q4-cal');
  });

  it('舊格式報告（無四榜明細）不能核准', async () => {
    await setup(report({ regression: { method: 'pearson', factors: [] } }));
    expect(component.reviewable()).toBe(false);
    expect(text()).toContain('舊格式');
  });

  it('尚無報告時顯示空狀態', async () => {
    await setup(null);
    expect(component.report()).toBeNull();
    expect(text()).toContain('尚未產生任何校準報告');
  });
});
