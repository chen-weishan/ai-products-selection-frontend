import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RuntimeSettingsService } from '../runtime-settings.service';
import { AdminRecoverySettingsComponent } from './admin-recovery-settings.component';

describe('AdminRecoverySettingsComponent', () => {
  let fixture: ComponentFixture<AdminRecoverySettingsComponent>;
  let component: AdminRecoverySettingsComponent;
  const config = {
    aiTaskRecoveryPollingEnabled: false,
    aiTaskRecoveryPollSeconds: 300,
    importPeriodicRecoveryEnabled: false,
    importRecoveryPollSeconds: 15,
    heatCatchUpEnabled: false,
    riskStartupRunEnabled: false,
  };
  const api = {
    getRecoveryConfig: vi.fn(),
    updateRecoveryConfig: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getRecoveryConfig.mockReturnValue(of(config));
    api.updateRecoveryConfig.mockImplementation((value) => of(value));
    await TestBed.configureTestingModule({
      imports: [AdminRecoverySettingsComponent],
      providers: [{ provide: RuntimeSettingsService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminRecoverySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads defaults without reporting unsaved changes', () => {
    expect(component.config).toEqual(config);
    expect(component.isDirty()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('FR-09 匯入批次恢復輪詢');
    expect(fixture.nativeElement.textContent).not.toContain('ai.task.recovery-poll-seconds');
    expect(fixture.nativeElement.textContent).not.toContain('ssds.calibration.heat-catch-up-enabled');
  });

  it('saves switches and custom polling intervals', () => {
    component.config!.aiTaskRecoveryPollingEnabled = true;
    component.config!.aiTaskRecoveryPollSeconds = 120;
    component.config!.importPeriodicRecoveryEnabled = true;
    component.config!.importRecoveryPollSeconds = 45;

    component.save();

    expect(api.updateRecoveryConfig).toHaveBeenCalledWith(expect.objectContaining({
      aiTaskRecoveryPollingEnabled: true,
      aiTaskRecoveryPollSeconds: 120,
      importPeriodicRecoveryEnabled: true,
      importRecoveryPollSeconds: 45,
    }));
    expect(component.isDirty()).toBe(false);
  });

  it('rejects non-positive or fractional polling intervals', () => {
    component.config!.importRecoveryPollSeconds = 0.5;
    expect(component.errors()).toEqual(['輪詢間隔須為至少 1 秒的整數']);
  });
});
