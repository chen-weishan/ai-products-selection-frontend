import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import {
  CreateDecisionDialogComponent,
  CreateDecisionDialogData,
} from './create-decision-dialog.component';
import { DecisionContext } from '../../../core/models/decision';

function context(patch: Partial<DecisionContext> = {}): DecisionContext {
  return {
    productId: 112,
    productName: '玻尿酸保濕精華',
    productStatus: 'WATCHING',
    trackType: 'A',
    score: { scoreId: 1247, period: '2026W40', sceneType: 'VIRAL', finalScore: 58.65, grade: 'C' },
    ai: { action: 'ADOPT', qtyMin: 100, qtyMax: 150, quantityText: '首批 100–150 件', reasoning: '熱度上升' },
    allowedDecisions: ['ADOPT', 'REJECT'],
    blockedReason: null,
    ...patch,
  };
}

/** §FR-11-1 建立決策表單：AC-11-2 理由必填、ADOPT 數量必填、預設帶入 AI 建議。 */
describe('CreateDecisionDialogComponent', () => {
  let component: CreateDecisionDialogComponent;
  let fixture: ComponentFixture<CreateDecisionDialogComponent>;
  let http: HttpTestingController;
  const closed: unknown[] = [];
  const dialogData: CreateDecisionDialogData = { productId: 112 };

  beforeEach(async () => {
    closed.length = 0;
    delete dialogData.initialDecision;
    await TestBed.configureTestingModule({
      imports: [CreateDecisionDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: { close: (v: unknown) => closed.push(v) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateDecisionDialogComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(ctx: DecisionContext): void {
    fixture.detectChanges();
    http.expectOne('/api/v1/products/112/decision-context').flush({ success: true, data: ctx });
    fixture.detectChanges();
  }

  it('預設選 AI 建議的動作，並帶入建議數量中位數', () => {
    load(context());

    expect(component.decision()).toBe('ADOPT');
    expect(component.firstOrderQty()).toBe(125);
    expect(component.reasonRequired()).toBe(false);
    expect(component.canSubmit()).toBe(true);
  });

  it('品項詳情指定觀察時優先預選 WATCH，不受 AI 建議覆蓋', () => {
    dialogData.initialDecision = 'WATCH';
    load(context({ allowedDecisions: ['ADOPT', 'WATCH', 'REJECT'] }));

    expect(component.decision()).toBe('WATCH');
    expect(component.reasonRequired()).toBe(true);
  });

  it('AC-11-2：選了與 AI 不同的決策時理由必填', () => {
    load(context());

    component.chooseDecision('REJECT');
    expect(component.reasonRequired()).toBe(true);
    expect(component.canSubmit()).toBe(false);
    component.reason.set('評論風險過高');
    expect(component.canSubmit()).toBe(true);
  });

  it('沒有 AI 建議時不預選決策，理由一律必填', () => {
    load(context({ ai: null }));

    expect(component.decision()).toBeNull();
    component.chooseDecision('ADOPT');
    component.firstOrderQty.set(50);
    expect(component.reasonRequired()).toBe(true);
    expect(component.canSubmit()).toBe(false);
  });

  it('§7.4 不允許的決策按鈕停用；完全不允許時顯示原因', () => {
    load(context({ allowedDecisions: [], blockedReason: '品項目前狀態為 LISTED，不可建立 ADOPT 決策' }));

    expect(fixture.nativeElement.textContent).toContain('不可建立 ADOPT 決策');
    expect(component.canSubmit()).toBe(false);
  });

  it('送出 ADOPT：帶數量與上架日，成功後關閉並回傳建立的決策', () => {
    load(context());
    component.expectedListDate.set('2026-10-05');
    component.submit();

    const req = http.expectOne('/api/v1/products/112/decisions');
    expect(req.request.body).toEqual({
      decision: 'ADOPT',
      firstOrderQty: 125,
      expectedListDate: '2026-10-05',
      reason: null,
    });
    req.flush({ success: true, data: { id: 93, productName: '玻尿酸保濕精華' } });
    expect(closed).toEqual([{ id: 93, productName: '玻尿酸保濕精華' }]);
  });

  it('後端欄位錯誤顯示在對應欄位下方', () => {
    load(context());
    component.chooseDecision('REJECT');
    component.reason.set('x');
    component.submit();

    http.expectOne('/api/v1/products/112/decisions').flush(
      {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: '欄位驗證失敗', fieldErrors: [{ field: 'reason', message: '理由太短' }] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(component.fieldErrors()['reason']).toBe('理由太短');
    expect(closed).toEqual([]);
  });
});
