import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DialogService } from '../../services/dialog-service';

import { AdminComponent } from './admin.component';
import { MasterDataService } from './master-data.service';
import { RuntimeSettingsService } from './runtime-settings.service';
import { RiskService } from '../risks/risk.service';

describe('AdminComponent', () => {
  let component: AdminComponent;
  let fixture: ComponentFixture<AdminComponent>;
  const api = {
    categories: vi.fn(),
    suppliers: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    deleteCategory: vi.fn(),
    deleteSupplier: vi.fn(),
  };
  const runtimeSettings = {
    getAiConfig: vi.fn(),
    updateAiConfig: vi.fn(),
    getSchedules: vi.fn(),
    updateSchedules: vi.fn(),
    getOperationalConfig: vi.fn(),
    updateOperationalConfig: vi.fn(),
  };
  const risks = {
    getRiskRules: vi.fn(),
    updateRuleThreshold: vi.fn(),
  };
  const dialogs = { Confirm: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    dialogs.Confirm.mockReturnValue(of(true));
    api.categories.mockReturnValue(of([
      { id: 1, name: '食品', sortOrder: 0, children: [] },
    ]));
    api.suppliers.mockReturnValue(of([
      { id: 2, name: '晨曦食品', contact: null, phone: null, note: null },
    ]));
    runtimeSettings.getAiConfig.mockReturnValue(of({
      models: {},
      dailyQuota: 1000,
      trackAShare: 0.7,
      trackBShare: 0.2,
      retryShare: 0.1,
      warningRatio: 0.8,
      rateLimitPerMinute: 20,
      trendRateLimitPerMinute: 5,
      batchItemCap: 150,
      retryMax: 3,
      timeoutSeconds: 30,
      sourcingTimeoutSeconds: 90,
      cacheDays: 6,
      trendCacheDays: 3,
      sourcingCacheDays: 3,
    }));
    runtimeSettings.getSchedules.mockReturnValue(of({ items: [] }));
    runtimeSettings.getOperationalConfig.mockReturnValue(of({
      loginMaxFailedAttempts: 5,
      loginLockDurationMinutes: 15,
      heatTagHalveAfterDays: 14,
      heatTagExpireDays: 30,
      scoringMinCategorySample: 10,
      sceneAdoptConfidence: 0.5,
      sceneScoringConfidence: 0.7,
      calibrationMinSample: 200,
    }));
    risks.getRiskRules.mockReturnValue(of({
      rules: [],
      recalculation: { running: false, progressPercent: 0 },
    }));
    await TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        { provide: MasterDataService, useValue: api },
        { provide: RuntimeSettingsService, useValue: runtimeSettings },
        { provide: RiskService, useValue: risks },
        { provide: DialogService, useValue: dialogs },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.flatCategories()).toHaveLength(1);
    expect(component.suppliers()).toHaveLength(1);
  });

  it('creates a category and reloads the category tree', () => {
    api.createCategory.mockReturnValue(of({
      id: 3,
      name: '飲料',
      parentId: null,
      parentName: null,
      sortOrder: 1,
    }));
    component.categoryForm.setValue({ name: '飲料', parentId: null, sortOrder: 1 });

    component.saveCategory();

    expect(api.createCategory).toHaveBeenCalledWith({
      name: '飲料',
      parentId: null,
      sortOrder: 1,
    });
    expect(api.categories).toHaveBeenCalledTimes(2);
  });

  it('updates the selected supplier', () => {
    const supplier = component.suppliers()[0];
    api.updateSupplier.mockReturnValue(of({ ...supplier, name: '晨曦貿易' }));
    component.editSupplier(supplier);
    component.supplierForm.patchValue({ name: '晨曦貿易' });

    component.saveSupplier();

    expect(api.updateSupplier).toHaveBeenCalledWith(2, {
      name: '晨曦貿易',
      contact: null,
      phone: null,
      note: null,
    });
  });

  it('deletes the selected category after confirmation', () => {
    api.deleteCategory.mockReturnValue(of(void 0));
    component.editCategory(component.flatCategories()[0]);

    component.deleteCategory();

    expect(api.deleteCategory).toHaveBeenCalledWith(1);
    expect(api.categories).toHaveBeenCalledTimes(2);
  });

  it('deletes the selected supplier after confirmation', () => {
    api.deleteSupplier.mockReturnValue(of(void 0));
    component.editSupplier(component.suppliers()[0]);

    component.deleteSupplier();

    expect(api.deleteSupplier).toHaveBeenCalledWith(2);
    expect(api.suppliers).toHaveBeenCalledTimes(2);
  });
});
