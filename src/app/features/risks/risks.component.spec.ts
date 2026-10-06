import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { Observable, Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { RisksComponent } from './risks.component';
import { RiskService } from './risk.service';
import { DialogService } from '../../services/dialog-service';
import { AuthService } from '../../core/auth/auth.service';
import { ProductReferenceControllerService } from '../../api';
import { RiskAlertItem, RiskSummary, RiskRulesResponse, RiskListResponse } from './risk.model';

describe('RisksComponent', () => {
  let component: RisksComponent;
  let fixture: ComponentFixture<RisksComponent>;
  let riskService: RiskService;
  let dialogService: DialogService;
  let authService: AuthService;

  const mockSummary: RiskSummary = {
    highRiskCount: 3,
    mediumRiskCount: 2,
    lowRiskCount: 1,
    monthlyHandledCount: 8,
    lastDetectedAt: '2026-10-06T12:00:00Z',
  };

  const mockAlerts: RiskAlertItem[] = [
    {
      id: 1,
      productId: 101,
      productName: '輕量透氣防潑水衝鋒衣',
      categoryId: 1,
      categoryName: '機能服飾',
      riskType: 'REVIEW_RISK',
      severity: 'HIGH',
      triggerValue: '負評率 18.5%',
      impact: '負評指標扣 15 分',
      detectedAt: '2026-10-06T11:00:00Z',
      status: 'OPEN',
    },
    {
      id: 2,
      productId: 102,
      productName: '北歐陶瓷研磨咖啡杯',
      categoryId: 2,
      categoryName: '生活居家',
      riskType: 'LOGISTICS_RISK',
      severity: 'MEDIUM',
      triggerValue: '陶瓷易碎件',
      impact: '物流損耗率扣 10 分',
      detectedAt: '2026-10-06T10:00:00Z',
      status: 'OPEN',
    },
  ];

  const mockRulesResponse: RiskRulesResponse = {
    rules: [
      {
        ruleCode: 'REVIEW_RISK',
        ruleName: '負評風險規則',
        severity: 'HIGH',
        enabled: true,
        thresholdJson: { negativeRateThreshold: 0.15 },
      },
    ],
    recalculation: {
      running: false,
      progressPercent: 100,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RisksComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideAnimationsAsync(),
        {
          provide: ProductReferenceControllerService,
          useValue: {
            getCategories: () =>
              of({
                data: [
                  { id: 1, name: '機能服飾' },
                  { id: 2, name: '生活居家' },
                ],
              }),
          },
        },
      ],
    }).compileComponents();

    riskService = TestBed.inject(RiskService);
    dialogService = TestBed.inject(DialogService);
    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 'test-buyer',
      name: '測試採購',
      role: 'BUYER',
      roles: ['BUYER'],
    });

    // Mock Service Methods
    vi.spyOn(riskService, 'getRiskSummary').mockReturnValue(of(mockSummary));
    vi.spyOn(riskService, 'getRisks').mockReturnValue(
      of({
        content: mockAlerts,
        page: 0,
        size: 10,
        totalElements: 2,
        totalPages: 1,
      }),
    );
    vi.spyOn(riskService, 'getRiskRules').mockReturnValue(of(mockRulesResponse));

    fixture = TestBed.createComponent(RisksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
  });

  it('should create and load initial summary and alerts', () => {
    expect(component).toBeTruthy();
    expect(component.summary().highRiskCount).toBe(3);
    expect(component.summary().mediumRiskCount).toBe(2);
    expect(component.alerts().length).toBe(2);
    expect(component.totalElements()).toBe(2);
  });

  it('should filter alerts and reset pageIndex on filter change', () => {
    const getRisksSpy = vi.spyOn(riskService, 'getRisks');
    component.searchKeyword.set('衝鋒衣');
    component.filterStatus.set('OPEN');
    component.filterSeverity.set('HIGH');
    component.filterRiskType.set('REVIEW_RISK');
    component.filterCategoryId.set(1);
    component.pageIndex.set(3);

    component.onFilterChange();

    expect(component.pageIndex()).toBe(0);
    expect(getRisksSpy).toHaveBeenCalledWith(
      {
        status: 'OPEN',
        severity: 'HIGH',
        riskType: 'REVIEW_RISK',
        categoryId: 1,
        keyword: '衝鋒衣',
      },
      0,
      10,
    );
  });

  it('should reset all filters to default', () => {
    component.searchKeyword.set('測試');
    component.filterSeverity.set('HIGH');
    component.filterStatus.set('IGNORED');

    component.resetFilters();

    expect(component.searchKeyword()).toBe('');
    expect(component.filterStatus()).toBe('ALL');
    expect(component.filterSeverity()).toBe('ALL');
    expect(component.filterRiskType()).toBe('ALL');
    expect(component.filterCategoryId()).toBe('ALL');
    expect(component.pageIndex()).toBe(0);
    expect(component.isDefaultFilter()).toBe(true);
  });

  it('should acknowledge alert when confirmed in dialog', () => {
    vi.spyOn(dialogService, 'Confirm').mockReturnValue(of(true));
    const ackSpy = vi
      .spyOn(riskService, 'acknowledgeRisk')
      .mockReturnValue(of({ ...mockAlerts[0], status: 'ACKNOWLEDGED' }));

    component.acknowledgeAlert(mockAlerts[0]);

    expect(ackSpy).toHaveBeenCalledWith(mockAlerts[0].id);
    expect(component.successMessage()).toContain('已成功確認處理示警');
  });

  it('should handle 409 conflict on acknowledge', () => {
    vi.spyOn(dialogService, 'Confirm').mockReturnValue(of(true));
    vi.spyOn(riskService, 'acknowledgeRisk').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );

    component.acknowledgeAlert(mockAlerts[0]);

    expect(component.errorMessage()).toContain('該示警已被其他人處理或狀態已變更');
  });

  it('should open and submit ignore dialog with validation', () => {
    const ignoreSpy = vi
      .spyOn(riskService, 'ignoreRisk')
      .mockReturnValue(of({ ...mockAlerts[0], status: 'IGNORED', ignoreReason: '季節性下架' }));

    // 開啟 Dialog
    component.openIgnoreDialog(mockAlerts[0]);
    expect(component.isIgnoreModalOpen()).toBe(true);
    expect(component.targetAlert()).toEqual(mockAlerts[0]);

    // 未填理由提交驗證
    component.ignoreReasonText.set('');
    component.submitIgnore();
    expect(component.ignoreError()).toContain('請填寫忽略理由');
    expect(ignoreSpy).not.toHaveBeenCalled();

    // 正常填寫理由提交
    component.ignoreReasonText.set('季節性下架，由主管核准');
    component.submitIgnore();

    expect(ignoreSpy).toHaveBeenCalledWith(mockAlerts[0].id, '季節性下架，由主管核准');
    expect(component.isIgnoreModalOpen()).toBe(false);
    expect(component.successMessage()).toContain('已將示警 #1 標記為忽略');
  });

  it('should open rules drawer and trigger threshold update for SYS_ADMIN', () => {
    const updateSpy = vi
      .spyOn(riskService, 'updateRuleThreshold')
      .mockReturnValue(of({ success: true, recalculationStarted: true }));

    // 開啟 Rules Drawer
    component.openRulesDrawer();
    expect(component.isRulesDrawerOpen()).toBe(true);
    expect(component.rulesList().length).toBe(1);

    // 模擬 SYS_ADMIN 權限並儲存規則
    vi.spyOn(component, 'isSysAdmin').mockReturnValue(true);
    component.updateThresholdDraft(mockRulesResponse.rules[0], '{"negativeRateThreshold":0.2}');
    component.saveRuleThreshold(mockRulesResponse.rules[0]);

    expect(updateSpy).toHaveBeenCalledWith(
      'REVIEW_RISK',
      { negativeRateThreshold: 0.2 },
      undefined,
      undefined,
    );
  });

  it('should handle pagination changes', () => {
    const getRisksSpy = vi.spyOn(riskService, 'getRisks');
    component.onPageChange({ pageIndex: 1, pageSize: 20, length: 50 });

    expect(component.pageIndex()).toBe(1);
    expect(component.pageSize()).toBe(20);
    expect(getRisksSpy).toHaveBeenCalledWith(expect.any(Object), 1, 20);
  });

  it('uses all assigned roles and labels open alerts correctly for viewers', () => {
    authService.currentUser.set({
      id: 'admin',
      name: '多角色',
      role: 'VIEWER',
      roles: ['VIEWER', 'SYS_ADMIN'],
    });
    expect(component.isSysAdmin()).toBe(true);
    expect(component.canManageRisks()).toBe(true);
    authService.currentUser.set({
      id: 'viewer',
      name: '觀察者',
      role: 'VIEWER',
      roles: ['VIEWER'],
    });
    expect(component.isSysAdmin()).toBe(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('無操作權限');
    expect(fixture.nativeElement.textContent).not.toContain('已結案');
    const ack = vi.spyOn(riskService, 'acknowledgeRisk');
    component.acknowledgeAlert(mockAlerts[0]);
    component.openIgnoreDialog(mockAlerts[0]);
    expect(ack).not.toHaveBeenCalled();
    expect(component.isIgnoreModalOpen()).toBe(false);
  });

  it('debounces search and cancels the previous request before new results can overwrite it', () => {
    vi.useFakeTimers();
    const older = new Subject<RiskListResponse>();
    const latest = new Subject<RiskListResponse>();
    const getRisks = vi
      .spyOn(riskService, 'getRisks')
      .mockReturnValueOnce(older)
      .mockReturnValueOnce(latest)
      .mockClear();
    component.loadAlerts();
    expect(older.observed).toBe(true);
    component.onSearchChange('咖');
    component.onSearchChange('咖啡');
    expect(older.observed).toBe(false);
    vi.advanceTimersByTime(299);
    expect(getRisks).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(getRisks).toHaveBeenCalledTimes(2);
    expect(getRisks).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '咖啡' }), 0, 10);
    latest.next({ content: [mockAlerts[1]], page: 0, size: 10, totalElements: 1, totalPages: 1 });
    older.next({ content: [mockAlerts[0]], page: 0, size: 10, totalElements: 1, totalPages: 1 });
    expect(component.alerts()[0].productId).toBe(102);
  });

  it('cancels a pending search when filters are reset', () => {
    vi.useFakeTimers();
    const request = vi.spyOn(riskService, 'getRisks');
    component.onSearchChange('舊搜尋');
    component.resetFilters();
    const calls = request.mock.calls.length;
    vi.advanceTimersByTime(500);
    expect(request).toHaveBeenCalledTimes(calls);
    expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '' }), 0, 10);
  });

  it('renders a failed list as an error, not an empty healthy list', () => {
    vi.spyOn(riskService, 'getRisks').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    component.loadAlerts();
    fixture.detectChanges();
    expect(component.alerts()).toEqual([]);
    expect(component.listError()).toContain('服務尚未提供');
    expect(fixture.nativeElement.textContent).toContain('重新載入清單');
    expect(fixture.nativeElement.textContent).not.toContain('目前無符合條件之風險示警');
  });

  it('shows unavailable summary values as dashes instead of zero risk', () => {
    vi.spyOn(riskService, 'getRiskSummary').mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    component.loadSummary();
    fixture.detectChanges();
    expect(component.summaryAvailable()).toBe(false);
    expect(component.summaryError()).toBeTruthy();
    const values = [...fixture.nativeElement.querySelectorAll('.kpi-card .v')] as HTMLElement[];
    expect(values.map((value) => value.textContent?.trim())).toEqual(['—', '—', '—', '—']);
  });

  it('prevents duplicate acknowledges and keeps failures from showing success', () => {
    vi.spyOn(dialogService, 'Confirm').mockReturnValue(of(true));
    const response = new Subject<RiskAlertItem>();
    const ack = vi.spyOn(riskService, 'acknowledgeRisk').mockReturnValue(response);
    component.acknowledgeAlert(mockAlerts[0]);
    component.acknowledgeAlert(mockAlerts[0]);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(component.isAlertPending(1)).toBe(true);
    response.error(new HttpErrorResponse({ status: 403 }));
    expect(component.isAlertPending(1)).toBe(false);
    expect(component.errorMessage()).toContain('沒有執行此操作的權限');
    expect(component.successMessage()).toBeNull();
    expect(component.alerts()[0].status).toBe('OPEN');
  });

  it('releases the acknowledge lock when the confirmation is cancelled', () => {
    vi.spyOn(dialogService, 'Confirm').mockReturnValue(of(false));
    const ack = vi.spyOn(riskService, 'acknowledgeRisk');
    component.acknowledgeAlert(mockAlerts[0]);
    expect(ack).not.toHaveBeenCalled();
    expect(component.isAlertPending(1)).toBe(false);
  });

  it('locks ignore submission against closing, switching and duplicate writes, and retains a failed draft', () => {
    const response = new Subject<RiskAlertItem>();
    const ignore = vi.spyOn(riskService, 'ignoreRisk').mockReturnValue(response);
    component.openIgnoreDialog(mockAlerts[0]);
    component.ignoreReasonText.set('核准特案採購');
    component.submitIgnore();
    component.submitIgnore();
    component.closeOverlay();
    component.closeIgnoreDialog();
    component.openIgnoreDialog(mockAlerts[1]);
    expect(ignore).toHaveBeenCalledTimes(1);
    expect(component.isIgnoreModalOpen()).toBe(true);
    expect(component.targetAlert()?.id).toBe(1);
    response.error(new HttpErrorResponse({ status: 500 }));
    expect(component.isSubmittingIgnore()).toBe(false);
    expect(component.ignoreReasonText()).toBe('核准特案採購');
    expect(component.ignoreError()).toContain('忽略失敗');
    expect(component.successMessage()).toBeNull();
    component.closeIgnoreDialog();
    expect(component.isIgnoreModalOpen()).toBe(false);
  });

  it('only allows valid changed thresholds and supports cancelling the edit', () => {
    authService.currentUser.set({ id: 'admin', name: '管理員', role: 'SYS_ADMIN' });
    component.openRulesDrawer();
    const rule = mockRulesResponse.rules[0];
    expect(component.canSaveRule(rule)).toBe(false);
    component.updateThresholdDraft(rule, '{');
    expect(component.getThresholdError(rule)).toContain('JSON 格式');
    component.updateThresholdDraft(rule, '[]');
    expect(component.getThresholdError(rule)).toContain('JSON 物件');
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":"0.2"}');
    expect(component.getThresholdError(rule)).toContain('資料類型');
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":1e309}');
    expect(component.getThresholdError(rule)).toContain('數值');
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":1.2}');
    expect(component.getThresholdError(rule)).toContain('介於 0 與 1');
    component.updateThresholdDraft(rule, '{"other":0.2}');
    expect(component.getThresholdError(rule)).toContain('保留既有門檻欄位');
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":0.2}');
    expect(component.canSaveRule(rule)).toBe(true);
    component.resetRuleDraft(rule);
    expect(component.canSaveRule(rule)).toBe(false);
  });

  it('retains edited thresholds after a failed save and blocks duplicate saves and closing', () => {
    authService.currentUser.set({ id: 'admin', name: '管理員', role: 'SYS_ADMIN' });
    component.openRulesDrawer();
    const rule = mockRulesResponse.rules[0];
    const response = new Subject<{ recalculationStarted?: boolean }>();
    const update = vi.spyOn(riskService, 'updateRuleThreshold').mockReturnValue(response);
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":0.2}');
    component.saveRuleThreshold(rule);
    component.saveRuleThreshold(rule);
    component.closeRulesDrawer();
    expect(update).toHaveBeenCalledTimes(1);
    expect(component.isRulesDrawerOpen()).toBe(true);
    response.error(new HttpErrorResponse({ status: 404 }));
    expect(component.savingRuleCode()).toBeNull();
    expect(component.thresholdDrafts()['REVIEW_RISK']).toContain('0.2');
    expect(component.ruleSaveErrors()['REVIEW_RISK']).toContain('服務尚未提供');
    expect(component.canSaveRule(rule)).toBe(false);
    expect(component.successMessage()).toBeNull();
    expect(component.rulesList()[0].thresholdJson['negativeRateThreshold']).toBe(0.15);
  });

  it('reports a successful save without claiming an unconfirmed recalculation', () => {
    authService.currentUser.set({ id: 'admin', name: '管理員', role: 'SYS_ADMIN' });
    component.openRulesDrawer();
    const rule = mockRulesResponse.rules[0];
    vi.spyOn(riskService, 'getRiskRules').mockReturnValue(
      of({
        ...mockRulesResponse,
        rules: [{ ...rule, thresholdJson: { negativeRateThreshold: 0.2 } }],
      }),
    );
    vi.spyOn(riskService, 'updateRuleThreshold').mockReturnValue(of({}));
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":0.2}');
    component.saveRuleThreshold(rule);
    expect(component.successMessage()).toContain('門檻已儲存');
    expect(component.successMessage()).not.toContain('重算');
    expect(component.rulesList()[0].thresholdJson['negativeRateThreshold']).toBe(0.2);
    expect(component.canSaveRule(component.rulesList()[0])).toBe(false);
  });

  it('keeps drafts separate for category overrides and makes fixed cap read-only', () => {
    const global = mockRulesResponse.rules[0];
    const category = { ...global, categoryId: 7 };
    component.updateThresholdDraft(global, '{"negativeRateThreshold":0.2}');
    component.updateThresholdDraft(category, '{"negativeRateThreshold":0.3}');
    expect(component.thresholdDrafts()[component.ruleKey(global)]).toContain('0.2');
    expect(component.thresholdDrafts()[component.ruleKey(category)]).toContain('0.3');
    expect(component.canSaveRule({ ...global, ruleCode: 'PENALTY_CAP' })).toBe(false);
  });

  it('shows a rules service error and leaves save unavailable until retry succeeds', () => {
    authService.currentUser.set({ id: 'admin', name: '管理員', role: 'SYS_ADMIN' });
    component.openRulesDrawer();
    const rule = mockRulesResponse.rules[0];
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":0.2}');
    const getRules = vi
      .spyOn(riskService, 'getRiskRules')
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })))
      .mockReturnValue(of(mockRulesResponse))
      .mockClear();
    component.loadRules();
    expect(component.rulesError()).toContain('服務尚未提供');
    expect(component.canSaveRule(rule)).toBe(false);
    component.loadRules();
    expect(getRules).toHaveBeenCalledTimes(2);
    expect(component.rulesError()).toBeNull();
    expect(component.thresholdDrafts()['REVIEW_RISK']).toContain('0.2');
    expect(component.canSaveRule(rule)).toBe(true);
  });

  it('does not treat an old idle snapshot as completion of a new save', () => {
    vi.useFakeTimers();
    authService.currentUser.set({ id: 'admin', name: '管理員', role: 'SYS_ADMIN' });
    component.openRulesDrawer();
    vi.spyOn(riskService, 'updateRuleThreshold').mockReturnValue(of({}));
    const rule = mockRulesResponse.rules[0];
    component.updateThresholdDraft(rule, '{"negativeRateThreshold":0.2}');
    component.saveRuleThreshold(rule);
    vi.advanceTimersByTime(2000);
    expect(component.successMessage()).not.toContain('已完成');
    vi.advanceTimersByTime(28000);
    expect(component.rulesError()).toContain('尚無法確認新一輪重算');
  });

  it('cancels an in-flight poll on close and prevents overlapping polls', () => {
    vi.useFakeTimers();
    const pending = new Subject<RiskRulesResponse>();
    const getRules = vi
      .spyOn(riskService, 'getRiskRules')
      .mockReturnValueOnce(
        of({
          ...mockRulesResponse,
          recalculation: { running: true, progressPercent: 10 },
        }),
      )
      .mockReturnValue(pending);
    component.openRulesDrawer();
    vi.advanceTimersByTime(6000);
    expect(getRules).toHaveBeenCalledTimes(2);
    expect(pending.observed).toBe(true);
    component.closeRulesDrawer();
    expect(pending.observed).toBe(false);
    pending.next(mockRulesResponse);
    vi.advanceTimersByTime(4000);
    expect(getRules).toHaveBeenCalledTimes(2);
    expect(component.successMessage()).toBeNull();
  });

  it('stops polling on failure without claiming completion', () => {
    vi.useFakeTimers();
    const getRules = vi
      .spyOn(riskService, 'getRiskRules')
      .mockReturnValueOnce(
        of({
          ...mockRulesResponse,
          recalculation: { running: true, progressPercent: 10 },
        }),
      )
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.openRulesDrawer();
    vi.advanceTimersByTime(6000);
    expect(getRules).toHaveBeenCalledTimes(2);
    expect(component.rulesError()).toContain('尚無法確認完成');
    expect(component.successMessage()).toBeNull();
    expect(component.rulesAvailable()).toBe(false);
  });

  it('cancels pending list and search work when leaving the page', () => {
    vi.useFakeTimers();
    let cancelled = false;
    const getRisks = vi
      .spyOn(riskService, 'getRisks')
      .mockReturnValue(
        new Observable(() => () => {
          cancelled = true;
        }),
      )
      .mockClear();
    component.loadAlerts();
    component.ngOnDestroy();
    vi.advanceTimersByTime(5000);
    expect(cancelled).toBe(true);
    expect(getRisks).toHaveBeenCalledTimes(1);
  });

  it('never declares a failed recalculation successful even at 100 percent', () => {
    vi.useFakeTimers();
    vi.spyOn(riskService, 'getRiskRules')
      .mockReturnValueOnce(
        of({
          ...mockRulesResponse,
          recalculation: { running: true, progressPercent: 10 },
        }),
      )
      .mockReturnValue(
        of({
          ...mockRulesResponse,
          recalculation: { running: false, progressPercent: 100, status: 'FAILED' },
        }),
      );
    component.openRulesDrawer();
    vi.advanceTimersByTime(2000);
    expect(component.rulesError()).toContain('重算失敗');
    expect(component.successMessage()).toBeNull();
  });
});
