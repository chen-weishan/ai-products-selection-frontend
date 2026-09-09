import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { RankingComponent } from './ranking.component';
import { FACTOR_CODES } from '../../core/models/weight';
import { ScoreRankingRow } from '../../core/models/score';

/** 只填測試會用到的欄位，其餘補預設值。 */
function row(patch: Partial<ScoreRankingRow> = {}): ScoreRankingRow {
  return {
    scoreId: 1,
    productId: 1,
    productName: '日式抹茶夾心餅乾',
    categoryName: '零食',
    sceneType: 'VIRAL',
    isPrimary: true,
    bonusSubtotal: 86.89,
    penaltySubtotal: 4,
    finalScore: 82.89,
    grade: 'B',
    confidence: 86,
    lowConfidence: false,
    riskSuppressed: false,
    factors: [],
    ...patch,
  };
}

describe('RankingComponent', () => {
  let component: RankingComponent;
  let fixture: ComponentFixture<RankingComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RankingComponent],
      // 元件在 ngOnInit 就會打 API、樣板有 routerLink，兩者都要有 provider 才建得起來
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RankingComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // ngOnInit 的初始載入（排行、四榜筆數、權重版本）不是本檔驗的對象，一次清掉
    http.match(() => true);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * AC-04-1 的顯示前提：因子長條順序固定。
   * 後端回的順序不保證，照回傳順序畫會讓每一列的第幾根代表不同因子。
   */
  it('因子長條依 FACTOR_CODES 固定排序，缺的補一根無資料空條', () => {
    const only = {
      factorCode: FACTOR_CODES[3],
      normalizedValue: 82,
      weight: 0.07,
      dataAvailable: true,
      imputed: false,
    };

    const bars = component.orderedFactors(row({ factors: [only] }));

    expect(bars.map((b) => b.factorCode)).toEqual([...FACTOR_CODES]);
    expect(bars[3].normalizedValue).toBe(82);
    // AC-04-3：沒有資料的因子顯示灰底空條，不是扣分
    expect(bars[0].dataAvailable).toBe(false);
    expect(bars[0].normalizedValue).toBeNull();
  });

  /**
   * §5.6 硬規則的旗標由後端判定，前端只讀 riskSuppressed，
   * 不自己寫 penaltySubtotal >= 20。
   */
  it('風險等級讀後端的 riskSuppressed，不自行比門檻', () => {
    expect(component.riskLevel(row({ penaltySubtotal: 20, riskSuppressed: true }))).toBe('high');
    expect(component.riskLevel(row({ penaltySubtotal: 4, riskSuppressed: false }))).toBe('mid');
    expect(component.riskLevel(row({ penaltySubtotal: 0, riskSuppressed: false }))).toBe('none');
  });

  it('沒有扣分的列不打扣分明細 API', () => {
    component.showDeductions(row({ penaltySubtotal: 0 }));

    http.expectNone(() => true);
    expect(component.deductions()).toBeNull();
  });

  it('有扣分的列展開時打 /scores/{id}/deductions', () => {
    component.showDeductions(row({ scoreId: 42, penaltySubtotal: 4 }));

    const req = http.expectOne('/api/v1/scores/42/deductions');
    req.flush({
      success: true,
      data: { scoreId: 42, penaltySubtotal: 4, riskSuppressed: false, items: [] },
    });

    expect(component.deductions()?.scoreId).toBe(42);
  });

  it('input type="week" 的值由 2026W30 轉為 2026-W30，格式不符回空字串', () => {
    component.period.set('2026W30');
    expect(component.periodInputValue()).toBe('2026-W30');

    component.period.set('亂填');
    expect(component.periodInputValue()).toBe('');
  });

  it('選擇期別時把 2026-W30 轉回後端要的 2026W30，並回到第一頁', () => {
    component.page.set(2);
    component.setPeriod('2026-W31');

    expect(component.period()).toBe('2026W31');
    expect(component.page()).toBe(0);
    http.match(() => true);
  });

  it('名次跨頁累加，試算結果則從 1 起算', () => {
    component.page.set(1);
    expect(component.rankNo(0)).toBe('21');

    component.simulated.set([row()]);
    expect(component.rankNo(0)).toBe('01');
  });

  /** 0 也要顯示得出來，所以 countOf 回字串；尚未載入時回 null。 */
  it('四榜筆數為 0 時仍顯示 0，未載入時不顯示', () => {
    component.counts.set({ VIRAL: 0 });
    expect(component.countOf('VIRAL')).toBe('0');
    expect(component.countOf('SEASONAL')).toBeNull();
  });

  it('百分比與分數的顯示格式避開浮點誤差，null 顯示破折號', () => {
    expect(component.percent(0.08)).toBe('8%');
    expect(component.percent(0.075)).toBe('7.5%');
    expect(component.percent(null)).toBe('—');
    expect(component.score(94.0)).toBe('94');
    expect(component.score(86.89)).toBe('86.89');
    expect(component.score(null)).toBe('—');
  });

  it('長條寬度收斂在 0%～100%', () => {
    expect(component.barWidth(48)).toBe('48%');
    expect(component.barWidth(150)).toBe('100%');
    expect(component.barWidth(-10)).toBe('0%');
    expect(component.barWidth(null)).toBe('0%');
  });

  /** AC-04-4：試算結果可還原至現行版本，且換條件即作廢。 */
  it('離開試算後表格改回資料庫既有分數', () => {
    component.rows.set([row({ scoreId: 7 })]);
    component.simulated.set([row({ scoreId: 99 })]);
    expect(component.displayRows()[0].scoreId).toBe(99);

    component.exitSimulation();

    expect(component.simulated()).toBeNull();
    expect(component.displayRows()[0].scoreId).toBe(7);
  });

  it('換榜時作廢試算結果並回到第一頁', () => {
    component.simulated.set([row()]);
    component.page.set(3);

    component.selectScene('SEASONAL');

    expect(component.scene()).toBe('SEASONAL');
    expect(component.page()).toBe(0);
    expect(component.simulated()).toBeNull();
    http.match(() => true);
  });
});
