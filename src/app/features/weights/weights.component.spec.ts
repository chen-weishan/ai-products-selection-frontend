import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WeightsComponent } from './weights.component';
import {
  CreateWeightVersionRequest,
  FACTOR_CODES,
  FactorCode,
  SCENE_TYPES,
  SceneType,
  WeightVersionDetail,
} from '../../core/models/weight';

/** 每榜都是 TREND 7.5、MARGIN 22.5、其餘四項各 17.5，加總 100。 */
const PERCENTS: Record<FactorCode, string> = {
  TREND: '7.5',
  MARGIN: '22.5',
  CVR: '17.5',
  PRICE_FIT: '17.5',
  FESTIVAL: '17.5',
  CLIMATE: '17.5',
};

describe('WeightsComponent', () => {
  let component: WeightsComponent;
  let fixture: ComponentFixture<WeightsComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeightsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(WeightsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    // ngOnInit 的版本清單載入不是本檔驗的對象，一次清掉
    http.match(() => true);
  });

  function fillAll(percents: Record<FactorCode, string>, scenes: SceneType[] = SCENE_TYPES): void {
    for (const scene of scenes) {
      for (const code of FACTOR_CODES) {
        component.setWeight(scene, code, percents[code]);
      }
    }
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('編輯草稿時，後端的 0.000–1.000 權重換成 0–100 顯示', () => {
    const weights = { TREND: 0.075, MARGIN: 0.3, CVR: 0.3, PRICE_FIT: 0.12, FESTIVAL: 0.05, CLIMATE: 0.155 };
    const detail: WeightVersionDetail = {
      id: 3, versionNo: 'v3', name: '草稿', status: 'DRAFT', isCurrent: false,
      effectiveFrom: null, changeNote: null, createdAt: '2026-10-01T00:00:00+08:00', approvedAt: null,
      sceneGroups: SCENE_TYPES.map((sceneType) => ({ sceneType, weights, weightSum: 1, gradeAMin: 85, gradeBMin: 70 })),
    };
    component.selected.set(detail);

    component.startEdit();

    const form = component.form().weights.REPLENISHMENT;
    // 0.075 * 100 在浮點下是 7.499999999999999，必須顯示成 7.5
    expect(form.TREND).toBe('7.5');
    expect(form.MARGIN).toBe('30');
    expect(form.CLIMATE).toBe('15.5');
    expect(component.formSums().REPLENISHMENT).toBe(100);
  });

  it('四榜都加總 100 才能送出；含小數的加總不受浮點誤差影響', () => {
    component.startCreate();
    fillAll(PERCENTS);
    expect(component.formSums().VIRAL).toBe(100);
    expect(component.canSubmit()).toBe(true);

    component.setWeight('SEASONAL', 'CLIMATE', '17.4');
    expect(component.formSums().SEASONAL).toBe(99.9);
    expect(component.canSubmit()).toBe(false);
  });

  it('超出 0–100、超過一位小數、空白的格子都不合法，不能送出', () => {
    component.startCreate();
    fillAll(PERCENTS);

    // 7.55 + 22.45 仍加總 100，但寫進 NUMERIC(4,3) 會被進位，核准時加總就不是 1
    component.setWeight('VIRAL', 'TREND', '7.55');
    component.setWeight('VIRAL', 'MARGIN', '22.45');
    expect(component.canSubmit()).toBe(false);

    expect(component.validWeight('101')).toBe(false);
    expect(component.validWeight('-1')).toBe(false);
    expect(component.validWeight('')).toBe(false);
    expect(component.validWeight('0')).toBe(true);
    expect(component.validWeight('100')).toBe(true);
  });

  it('送出時把百分比換回後端的 0.000–1.000', () => {
    component.startCreate();
    component.setField('versionNo', 'v9');
    component.setField('name', '測試');
    fillAll(PERCENTS);

    component.submit();

    const req = http.expectOne((r) => r.method === 'POST' && r.url === '/api/v1/weight-versions');
    const body = req.request.body as CreateWeightVersionRequest;
    const viral = body.sceneGroups.find((g) => g.sceneType === 'VIRAL')!;
    expect(viral.weights.TREND).toBe(0.075);
    expect(viral.weights.MARGIN).toBe(0.225);
    expect(viral.weights.CVR).toBe(0.175);
  });
});
