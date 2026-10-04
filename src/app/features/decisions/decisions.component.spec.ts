import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { DecisionsComponent } from './decisions.component';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/auth-model';
import { Decision, DecisionAccuracy } from '../../core/models/decision';

/** 只填測試會用到的欄位，其餘補預設值。 */
function decision(patch: Partial<Decision> = {}): Decision {
  return {
    id: 92,
    productId: 112,
    productName: '玻尿酸保濕精華',
    categoryName: '保養品',
    productStatus: 'LISTED',
    decision: 'ADOPT',
    aiAction: 'ADOPT',
    followedAi: true,
    aiQtyMin: 100,
    aiQtyMax: 150,
    firstOrderQty: 120,
    expectedListDate: null,
    campaignEndDate: '2026-09-29',
    reason: null,
    decidedById: 1,
    decidedByName: '採購專員',
    decidedAt: '2026-09-29T13:13:00+08:00',
    reviewedById: null,
    reviewedByName: null,
    reviewedAt: null,
    scoreId: 1247,
    period: '2026W40',
    sceneType: 'VIRAL',
    finalScore: 58.65,
    grade: 'C',
    stage: 'PENDING_RESULT',
    overdueDays: null,
    result: null,
    ...patch,
  };
}

function accuracy(patch: Partial<DecisionAccuracy> = {}): DecisionAccuracy {
  return {
    from: null,
    to: null,
    categoryId: null,
    decidedBy: null,
    totalDecisions: 11,
    sampleSize: 7,
    scoreSalesCorrelation: 0.6651,
    gradeAHitRate: 1,
    gradeAHitCount: 1,
    gradeASampleSize: 1,
    sceneOverrideRate: 0.2727,
    sceneOverrideCount: 3,
    aiAdoptionRate: 0.7273,
    aiFollowedCount: 8,
    minSample: 200,
    belowMinSample: true,
    validityWarning: '樣本數不足，本數據僅供觀察趨勢，不足以支持權重調整',
    ...patch,
  };
}

const page = (content: Decision[]) => ({
  success: true,
  data: { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 },
});

describe('DecisionsComponent', () => {
  let component: DecisionsComponent;
  let fixture: ComponentFixture<DecisionsComponent>;
  let http: HttpTestingController;

  function loginAs(role: UserRole): void {
    TestBed.inject(AuthService).currentUser.set({ id: 1, username: 'u', name: 'u', role });
  }

  /** 走完 ngOnInit：清單（含選第一筆的詳情與快照）、準確度、品類、決策者。 */
  function init(list: Decision[], acc = accuracy()): void {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/decisions' && r.params.get('size') === '20').flush(page(list));
    http.match((r) => r.url === '/api/v1/decisions' && r.params.get('size') === '100').forEach((r) => r.flush(page(list)));
    http.expectOne('/api/v1/decisions/accuracy').flush({ success: true, data: acc });
    http.match('/api/v1/categories').forEach((r) => r.flush({ success: true, data: [] }));
    if (list.length > 0) {
      http.expectOne(`/api/v1/decisions/${list[0].id}`).flush({ success: true, data: list[0] });
      http.match(`/api/v1/decisions/${list[0].id}/snapshot`).forEach((r) => r.flush({ success: true, data: null }));
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DecisionsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('載入後預設選第一筆決策，進度條走到「結案」', () => {
    loginAs('BUYER');
    init([decision()]);

    expect(component.selected()?.id).toBe(92);
    expect(component.steps().map((s) => s.done)).toEqual([true, true, true, false]);
  });

  it('回填時百分比換回 0–1 四位小數（39.4% → 0.394）', () => {
    loginAs('DATA_ADMIN');
    init([decision()]);

    component.actualQty.set(138);
    component.selloutStatus.set('ON_TIME');
    component.returnRatePct.set(1.2);
    component.marginPct.set(39.4);
    component.submitResult();

    const req = http.expectOne('/api/v1/decisions/92/result');
    expect(req.request.body).toEqual({
      actualQty: 138,
      selloutStatus: 'ON_TIME',
      returnRate: 0.012,
      realizedMarginRate: 0.394,
      postNoteCode: null,
      postNoteText: null,
    });
    req.flush({ success: true, data: decision({ stage: 'COMPLETED' }) });
    // 回填後重新載入準確度
    http.expectOne('/api/v1/decisions/accuracy').flush({ success: true, data: accuracy({ sampleSize: 8 }) });
    expect(component.selected()?.stage).toBe('COMPLETED');
    expect(component.accuracy()?.sampleSize).toBe(8);
  });

  it('回填必填欄位未齊時不能送出', () => {
    loginAs('BUYER');
    init([decision()]);

    component.actualQty.set(138);
    component.selloutStatus.set('ON_TIME');
    expect(component.canSubmitResult()).toBe(false);
    component.marginPct.set(39.4);
    expect(component.canSubmitResult()).toBe(true);
  });

  it('AC-11-5：樣本不足警示顯示且沒有關閉按鈕', () => {
    loginAs('VIEWER');
    init([]);

    const warning: HTMLElement = fixture.nativeElement.querySelector('.validity');
    expect(warning.textContent).toContain('樣本數不足');
    expect(warning.querySelector('button')).toBeNull();
  });

  it('樣本達門檻時不顯示警示', () => {
    loginAs('VIEWER');
    init([], accuracy({ belowMinSample: false, validityWarning: null }));

    expect(fixture.nativeElement.querySelector('.validity')).toBeNull();
  });

  it('AC-11-8：WATCH 決策不顯示結案與回填入口', () => {
    loginAs('BUYER');
    init([decision({ decision: 'WATCH', stage: 'NO_CAMPAIGN', campaignEndDate: null })]);

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('不提供結案與回填入口');
    expect(text).not.toContain('送出回填');
    expect(text).not.toContain('標記結案');
  });

  it('§2.1：VIEWER 看不到新增決策、回填表單；BUYER_LEAD 看得到覆核', () => {
    loginAs('VIEWER');
    init([decision()]);
    expect(component.canCreate()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('送出回填');
    expect(component.canReview()).toBe(false);

    loginAs('BUYER_LEAD');
    fixture.detectChanges();
    expect(component.canCreate()).toBe(true);
    expect(component.canReview()).toBe(true);
  });

  it('逾期的決策在清單顯示「逾 N 天」', () => {
    loginAs('BUYER');
    init([decision({ overdueDays: 12, stage: 'PENDING_RESULT' })]);

    expect(fixture.nativeElement.querySelector('.rows').textContent).toContain('逾 12 天');
  });
});
