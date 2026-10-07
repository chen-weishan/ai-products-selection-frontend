import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { BASE_PATH } from '../../../api';
import { AuthService } from '../../../core/auth/auth.service';
import { ProductDetailComponent } from './product-detail.component';

describe('ProductDetailComponent', () => {
  let component: ProductDetailComponent;
  let fixture: ComponentFixture<ProductDetailComponent>;
  let http: HttpTestingController;
  const dialog = { open: vi.fn() };

  beforeEach(async () => {
    dialog.open.mockReset();
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    await TestBed.configureTestingModule({
      imports: [ProductDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: '/api/v1' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '7' }),
              queryParamMap: convertToParamMap({ period: '2026W30' }),
            },
          },
        },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
        { provide: AuthService, useValue: { hasRole: () => true } },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetailComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('載入 S-06 所需資料並固定補齊六個加分因子與三個扣分項', () => {
    flushInitialRequests();

    expect(component.product()?.name).toBe('日式抹茶夾心餅乾');
    expect(component.scene()?.signals).toEqual(['Threads 7 日成長 340%']);
    expect(component.factorRows().map((row) => row.code)).toEqual([
      'TREND',
      'MARGIN',
      'CVR',
      'PRICE_FIT',
      'FESTIVAL',
      'CLIMATE',
    ]);
    expect(component.penaltyRows().map((row) => row.code)).toEqual([
      'REVIEW_RISK',
      'LOGISTICS_RISK',
      'INVENTORY_RISK',
    ]);
    expect(component.score()?.finalScore).toBe(82.89);
    expect(component.reviewPenalty()).toBe(0);

    fixture.detectChanges();
    const renderedText = fixture.nativeElement.textContent;
    expect(renderedText).not.toContain('Threads 7 日成長 340%');
    expect(renderedText).toContain('AI 情境判定');
    expect(renderedText).toContain('AI 分析');
    expect(renderedText).not.toContain('✦');
    expect(renderedText).toContain('AI 進貨建議');
    expect(renderedText).toContain('✓抹茶風味濃郁');
    expect(renderedText).toContain('⚠夏季易融化');
    expect(renderedText).toContain('建立決策');
    expect(renderedText).not.toContain('建立開團決策（尚未開放）');
  });

  it('從 S-06 開啟既有決策對話框，觀察操作預選 WATCH，成功後同步品項狀態', () => {
    flushInitialRequests();
    dialog.open.mockReturnValue({
      afterClosed: () =>
        of({
          decision: 'WATCH',
          productStatus: 'WATCHING',
        }),
    });

    component.openDecision('WATCH');

    expect(dialog.open).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        data: { productId: 7, initialDecision: 'WATCH' },
        maxWidth: '96vw',
        autoFocus: false,
      }),
    );
    expect(component.product()?.status).toBe('WATCHING');
    expect(component.successMessage()).toContain('已建立觀察決策');
  });

  it('分開處理 0.5 採用門檻與 0.7 計分門檻', () => {
    flushInitialRequests();

    component.scene.set({ sceneType: 'VIRAL', confidence: 0.49, signals: ['x'] });
    expect(component.confidenceState()).toBe('fallback');
    expect(component.effectivePrimaryScene()).toBe('REPLENISHMENT');

    component.scene.set({ sceneType: 'VIRAL', confidence: 0.6, signals: ['x'] });
    expect(component.confidenceState()).toBe('low');
    expect(component.effectivePrimaryScene()).toBe('VIRAL');

    component.scene.set({ sceneType: 'VIRAL', confidence: 0.82, signals: ['x'] });
    expect(component.confidenceState()).toBe('normal');
  });

  it('將六種品項狀態顯示為既有語意的中文標籤', () => {
    flushInitialRequests();

    expect(component.productStatusLabel('DRAFT')).toBe('草稿');
    expect(component.productStatusLabel('EVALUATING')).toBe('待評估');
    expect(component.productStatusLabel('WATCHING')).toBe('觀察中');
    expect(component.productStatusLabel('ADOPTED')).toBe('已採納');
    expect(component.productStatusLabel('LISTED')).toBe('已上架');
    expect(component.productStatusLabel('REJECTED')).toBe('已淘汰');

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('待評估');
    expect(fixture.nativeElement.textContent).not.toContain('EVALUATING');
  });

  it('切換次要情境只查詢分數，不送出寫入請求', () => {
    flushInitialRequests();

    component.selectScene('REPLENISHMENT');
    const request = http.expectOne(
      (req) =>
        req.url === '/api/v1/products/7/scores' &&
        req.params.get('period') === '2026W30' &&
        req.params.get('scene') === 'REPLENISHMENT',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: scoreFixture('REPLENISHMENT') });

    expect(component.selectedScene()).toBe('REPLENISHMENT');
  });

  it('覆寫理由必填；有效覆寫送出情境與理由並重新讀取情境及分數', () => {
    flushInitialRequests();

    component.openOverride();
    component.overrideForm.patchValue({ sceneType: 'SEASONAL', reason: '  ' });
    component.submitOverride();
    http.expectNone((req) => req.url.endsWith('/scene-override'));

    component.overrideForm.patchValue({ reason: '依近期氣候與檔期調整' });
    component.submitOverride();
    const overrideRequest = http.expectOne('/api/v1/products/7/scene-override');
    expect(overrideRequest.request.method).toBe('PUT');
    expect(overrideRequest.request.body).toEqual({
      sceneType: 'SEASONAL',
      reason: '依近期氣候與檔期調整',
    });
    overrideRequest.flush({ success: true, data: {} });

    http
      .expectOne('/api/v1/products/7/scene-classification/latest')
      .flush({ success: true, data: sceneFixture('SEASONAL') });
    http
      .expectOne(
        (req) => req.url === '/api/v1/products/7/scores' && req.params.get('scene') === 'SEASONAL',
      )
      .flush({ success: true, data: scoreFixture('SEASONAL') });

    expect(component.selectedScene()).toBe('SEASONAL');
    expect(component.successMessage()).toContain('已儲存');
  });

  function flushInitialRequests(): void {
    http.expectOne('/api/v1/products/7').flush({
      success: true,
      data: {
        id: 7,
        name: '日式抹茶夾心餅乾',
        categoryName: '零食類',
        trackType: 'A',
        status: 'EVALUATING',
        logisticsConditions: ['MELTABLE'],
      },
    });
    http
      .expectOne('/api/v1/products/7/scene-classification/latest')
      .flush({ success: true, data: sceneFixture('VIRAL') });
    http
      .expectOne(
        (req) => req.url === '/api/v1/products/7/scores' && req.params.get('period') === '2026W30',
      )
      .flush({ success: true, data: scoreFixture('VIRAL') });
    http.expectOne('/api/v1/products/7/product-insight/latest').flush({
      success: true,
      data: {
        sellingPoints: [{ text: '抹茶風味濃郁', supportCount: 12 }],
        risks: [{ text: '夏季易融化', supportCount: 3, countedInPenalty: true }],
        analysisCompleted: true,
      },
    });
    http.expectOne('/api/v1/products/7/review-risk/latest').flush({
      success: true,
      data: { reviews: [], topicStatistics: [], analysisCompleted: true },
    });
    http.expectOne('/api/v1/products/7/recommendation/latest').flush({
      success: true,
      data: { action: 'WATCH', reasoning: '先小量試單' },
    });
    fixture.detectChanges();
  }
});

function sceneFixture(sceneType: 'VIRAL' | 'FESTIVAL' | 'REPLENISHMENT' | 'SEASONAL') {
  return {
    productId: 7,
    sceneType,
    alternativeScene: sceneType === 'VIRAL' ? 'REPLENISHMENT' : 'VIRAL',
    confidence: 0.82,
    reasoning:
      'heatStage 為 RISING 且無明確節慶主導（festivalMatches 中各節慶 affinity 均未達高匹配門檻），符合 VIRAL 判定原則。',
    signals: ['Threads 7 日成長 340%'],
    fallbackApplied: false,
  };
}

function scoreFixture(sceneType: 'VIRAL' | 'FESTIVAL' | 'REPLENISHMENT' | 'SEASONAL') {
  return {
    productId: 7,
    period: '2026W30',
    sceneType,
    bonusSubtotal: 86.89,
    penaltySubtotal: 4,
    finalScore: 82.89,
    grade: 'B',
    confidence: 86,
    bonusFactors: [
      {
        factorCode: 'TREND',
        rawValue: 3.4,
        normalizedValue: 96,
        weight: 0.5,
        contribution: 48,
        dataAvailable: true,
      },
    ],
    penaltyFactors: [{ factorCode: 'LOGISTICS_RISK', penaltyValue: 4, dataAvailable: true }],
  };
}
