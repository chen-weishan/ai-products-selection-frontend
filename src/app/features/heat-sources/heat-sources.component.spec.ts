import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeatSourcesComponent } from './heat-sources.component';
import { HeatSourceControllerService, HeatSourceDetailResponse, ExcludedHeatSourceResponse } from '../../api';
import { AuthService } from '../../core/auth/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';

describe('HeatSourcesComponent', () => {
  let component: HeatSourcesComponent;
  let fixture: ComponentFixture<HeatSourcesComponent>;

  let mockHeatSourceApi: any;
  let mockAuthService: any;
  let mockSnackBar: any;

  const sampleSources: HeatSourceDetailResponse[] = [
    {
      id: 1,
      sourceCode: 'THREADS',
      adapterType: 'REST 排程',
      granularity: 'KEYWORD',
      compositeWeight: 0.4,
      availability: 'AVAILABLE',
      quotaUsed: 350,
      quotaLimit: 1000,
      lastFetchedAt: '2026-10-01T06:00:00Z',
      lastProbedAt: '2026-10-01T06:15:00Z',
      consecutiveProbeFailures: 0,
      enabled: true
    },
    {
      id: 2,
      sourceCode: 'GOOGLE_TRENDS',
      adapterType: '非官方',
      granularity: 'KEYWORD',
      compositeWeight: 0.25,
      availability: 'AVAILABLE',
      quotaUsed: 0,
      quotaLimit: 5000,
      lastFetchedAt: '2026-10-01T06:00:00Z',
      lastProbedAt: '2026-10-01T06:15:00Z',
      consecutiveProbeFailures: 0,
      enabled: true
    },
    {
      id: 3,
      sourceCode: 'INSTAGRAM',
      adapterType: 'Graph API',
      granularity: 'CATEGORY',
      compositeWeight: 0.1,
      availability: 'DEGRADED',
      quotaUsed: 850,
      quotaLimit: 1000,
      lastFetchedAt: '2026-09-28T06:00:00Z',
      lastProbedAt: '2026-10-01T06:15:00Z',
      consecutiveProbeFailures: 1,
      enabled: true
    },
    {
      id: 4,
      sourceCode: 'MANUAL',
      adapterType: '內部資料庫',
      granularity: '混合(依標記)',
      compositeWeight: 0.25,
      availability: 'AVAILABLE',
      quotaUsed: 120,
      quotaLimit: null as any,
      lastFetchedAt: '2026-10-01T07:00:00Z',
      lastProbedAt: '2026-10-01T07:00:00Z',
      consecutiveProbeFailures: 0,
      enabled: true
    }
  ];

  const sampleExcluded: ExcludedHeatSourceResponse[] = [
    { platform: 'FACEBOOK', reason: 'CrowdTangle 已關閉，替代品僅開放學術/非營利資格' },
    { platform: 'TIKTOK', reason: 'Research API 排除商業使用者，台灣不在適用資格地區' },
    { platform: 'XIAOHONGSHU', reason: '無公開 API，第三方平台條款禁止爬蟲轉供商業使用' }
  ];

  beforeEach(async () => {
    mockHeatSourceApi = {
      list4: vi.fn().mockReturnValue(of({ success: true, data: sampleSources })),
      excluded: vi.fn().mockReturnValue(of({ success: true, data: sampleExcluded })),
      get2: vi.fn(),
      update2: vi.fn().mockReturnValue(of({ success: true, data: sampleSources[0] })),
      test: vi.fn().mockReturnValue(of({
        success: true,
        data: { sourceCode: 'THREADS', success: true, availability: 'AVAILABLE', message: '探測成功' }
      }))
    };

    mockAuthService = {
      currentUser: signal({ id: 1, role: 'SYS_ADMIN', roles: ['SYS_ADMIN'], username: 'admin' }),
      hasRole: vi.fn().mockReturnValue(true)
    };

    mockSnackBar = {
      open: vi.fn()
    };

    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    await TestBed.configureTestingModule({
      imports: [HeatSourcesComponent],
      providers: [
        { provide: HeatSourceControllerService, useValue: mockHeatSourceApi },
        { provide: AuthService, useValue: mockAuthService },
        { provide: MatSnackBar, useValue: mockSnackBar }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeatSourcesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create and load initial sources and excluded sources', () => {
    expect(component).toBeTruthy();
    expect(mockHeatSourceApi.list4).toHaveBeenCalled();
    expect(mockHeatSourceApi.excluded).toHaveBeenCalled();
    expect(component.sources().length).toBe(4);
    expect(component.excludedSources().length).toBe(3);
    expect(component.activeCount()).toBe(4);
    expect(component.availableCount()).toBe(3);
    expect(component.degradedCount()).toBe(1);
    expect(component.unavailableCount()).toBe(0);
  });

  describe('Quota formatting (Cents in USD)', () => {
    it('should format cents to USD with limits and percentage', () => {
      const formatted = component.formatQuota(sampleSources[0]); // 350 / 1000
      expect(formatted).toBe('$3.50 / $10.00 (35%)');
    });

    it('should format cents correctly when quota is zero', () => {
      const formatted = component.formatQuota(sampleSources[1]); // 0 / 5000
      expect(formatted).toBe('$0.00 / $50.00 (0%)');
    });

    it('should format MANUAL source with null quotaLimit as 無上限 without NaN', () => {
      const formatted = component.formatQuota(sampleSources[3]); // 120 / null
      expect(formatted).toBe('$1.20 / 無上限');
      expect(formatted).not.toContain('NaN');
    });

    it('should identify quota higher than 80%', () => {
      expect(component.isQuotaHigh(sampleSources[0])).toBe(false); // 35%
      expect(component.isQuotaHigh(sampleSources[2])).toBe(true);  // 85%
      expect(component.isQuotaHigh(sampleSources[3])).toBe(false); // null limit
    });
  });

  describe('3-State Lamp Status & Diagnostic Tooltips', () => {
    it('should map availability states to correct lamp badges', () => {
      const normalBadge = component.getStatusBadge('AVAILABLE');
      expect(normalBadge.label).toBe('正常');
      expect(normalBadge.cssClass).toBe('status-normal');

      const warnBadge = component.getStatusBadge('DEGRADED');
      expect(warnBadge.label).toBe('降級');
      expect(warnBadge.cssClass).toBe('status-warn');

      const dangerBadge = component.getStatusBadge('UNAVAILABLE');
      expect(dangerBadge.label).toBe('不可用');
      expect(dangerBadge.cssClass).toBe('status-danger');
    });

    it('should generate helpful tooltip diagnostics', () => {
      const normalTip = component.getStatusTooltip(sampleSources[0]);
      expect(normalTip).toBe('服務正常，探測無異常');

      const degradedTip = component.getStatusTooltip(sampleSources[2]);
      expect(degradedTip).toContain('連續探測失敗 1 次');
      expect(degradedTip).toContain('額度高於 80%');

      const disabledRow: HeatSourceDetailResponse = {
        ...sampleSources[0],
        enabled: false,
        consecutiveProbeFailures: 2,
        quotaUsed: 1000,
        quotaLimit: 1000
      };
      const disabledTip = component.getStatusTooltip(disabledRow);
      expect(disabledTip).toContain('來源已被停用');
      expect(disabledTip).toContain('連續探測失敗 2 次');
      expect(disabledTip).toContain('額度已耗盡 (100%)');
    });
  });

  describe('Dynamic Weight Renormalization (§5.3.2)', () => {
    it('should recalculate weights when a source is UNAVAILABLE', () => {
      // Modify source 3 to UNAVAILABLE
      const sourcesWithUnavailable: HeatSourceDetailResponse[] = [
        { ...sampleSources[0], compositeWeight: 0.4 },
        { ...sampleSources[1], compositeWeight: 0.25 },
        { ...sampleSources[2], compositeWeight: 0.1, availability: 'UNAVAILABLE' }, // excluded
        { ...sampleSources[3], compositeWeight: 0.25 }
      ];
      component.sources.set(sourcesWithUnavailable);

      const recomputed = component.recalculatedWeights();
      expect(recomputed.length).toBe(3); // only 3 available sources contribute
      // Total remaining = 0.4 + 0.25 + 0.25 = 0.9
      // Threads: 0.4 / 0.9 = 44.4%
      // Trends: 0.25 / 0.9 = 27.8%
      // Manual: 0.25 / 0.9 = 27.8%
      expect(recomputed[0].newPct).toBe(44.4);
      expect(recomputed[1].newPct).toBe(27.8);
      expect(recomputed[2].newPct).toBe(27.8);
    });
  });

  describe('Connection Test (AC-14-5 & Permissions)', () => {
    it('should block non-SYS_ADMIN users from testing connection', () => {
      mockAuthService.hasRole.mockReturnValue(false);
      component.testConnection(sampleSources[0]);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('僅系統管理員 (SYS_ADMIN) 可執行連線測試'),
        '關閉',
        expect.any(Object)
      );
      expect(mockHeatSourceApi.test).not.toHaveBeenCalled();
    });

    it('should allow SYS_ADMIN to test connection and display probe result', () => {
      mockAuthService.hasRole.mockReturnValue(true);
      component.testConnection(sampleSources[0]);

      expect(mockHeatSourceApi.test).toHaveBeenCalledWith(
        { id: 1 },
        'body',
        false,
        expect.any(Object)
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('探測成功'),
        '關閉',
        expect.any(Object)
      );
    });

    it('should handle test connection error gracefully', () => {
      mockAuthService.hasRole.mockReturnValue(true);
      mockHeatSourceApi.test.mockReturnValue(throwError(() => new Error('連線超時')));

      component.testConnection(sampleSources[0]);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('連線測試失敗'),
        '關閉',
        expect.any(Object)
      );
      expect(component.isRowTesting(1)).toBe(false);
    });
  });

  describe('Toggle Enabled (SYS_ADMIN Only)', () => {
    it('should block non-SYS_ADMIN users from toggling enabled', () => {
      mockAuthService.hasRole.mockReturnValue(false);
      component.toggleEnabled(sampleSources[0]);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('僅系統管理員 (SYS_ADMIN) 可切換來源啟用狀態'),
        '關閉',
        expect.any(Object)
      );
      expect(mockHeatSourceApi.update2).not.toHaveBeenCalled();
    });

    it('should toggle enabled when confirmed by SYS_ADMIN', () => {
      mockAuthService.hasRole.mockReturnValue(true);
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      component.toggleEnabled(sampleSources[0]); // currently enabled = true -> toggle to false

      expect(mockHeatSourceApi.update2).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          heatSourceUpdateRequest: { enabled: false }
        }),
        'body',
        false,
        expect.any(Object)
      );
    });
  });

  describe('Weight Editing, Dirty Check, and Validation (SYS_ADMIN)', () => {
    it('should block non-SYS_ADMIN from starting weight edit', () => {
      mockAuthService.hasRole.mockReturnValue(false);
      component.startEditWeight(sampleSources[0]);

      expect(component.editingWeightId()).toBeNull();
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('僅系統管理員 (SYS_ADMIN) 可調整合成權重'),
        '關閉',
        expect.any(Object)
      );
    });

    it('should populate edit input percentage for SYS_ADMIN', () => {
      mockAuthService.hasRole.mockReturnValue(true);
      component.startEditWeight(sampleSources[0]); // compositeWeight = 0.4

      expect(component.editingWeightId()).toBe(1);
      expect(component.editWeightInput()).toBe(40);
    });

    it('should validate invalid weight values (< 0 or > 100)', () => {
      mockAuthService.hasRole.mockReturnValue(true);
      component.startEditWeight(sampleSources[0]);

      component.editWeightInput.set(120);
      component.saveWeight(sampleSources[0]);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('0% 到 100% 之間'),
        '關閉',
        expect.any(Object)
      );
      expect(mockHeatSourceApi.update2).not.toHaveBeenCalled();

      component.editWeightInput.set(-5);
      component.saveWeight(sampleSources[0]);
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('0% 到 100% 之間'),
        '關閉',
        expect.any(Object)
      );
      expect(mockHeatSourceApi.update2).not.toHaveBeenCalled();
    });

    it('should perform Dirty Check and NOT send PUT if weight is unchanged', () => {
      mockAuthService.hasRole.mockReturnValue(true);
      component.startEditWeight(sampleSources[0]); // original 40%

      component.editWeightInput.set(40); // unchanged
      component.saveWeight(sampleSources[0]);

      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('權重數值未變更，已取消更新'),
        '關閉',
        expect.any(Object)
      );
      expect(mockHeatSourceApi.update2).not.toHaveBeenCalled();
      expect(component.editingWeightId()).toBeNull();
    });

    it('should send PUT with 3 decimal places and notify async recalculation when weight changed', () => {
      mockAuthService.hasRole.mockReturnValue(true);
      component.startEditWeight(sampleSources[0]); // original 40%

      component.editWeightInput.set(45.5); // changed to 45.5% = 0.455
      component.saveWeight(sampleSources[0]);

      expect(mockHeatSourceApi.update2).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          heatSourceUpdateRequest: { compositeWeight: 0.455 }
        }),
        'body',
        false,
        expect.any(Object)
      );
      expect(mockSnackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('系統將非同步重算品項評分'),
        '關閉',
        expect.any(Object)
      );
      expect(component.editingWeightId()).toBeNull();
    });

    it('should cancel edit mode when cancelEditWeight is called', () => {
      component.startEditWeight(sampleSources[0]);
      expect(component.editingWeightId()).toBe(1);

      component.cancelEditWeight();
      expect(component.editingWeightId()).toBeNull();
      expect(component.editWeightInput()).toBeNull();
    });
  });
});
