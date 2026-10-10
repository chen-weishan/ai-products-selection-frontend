import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import { environment } from '../../../environments/environment';
import { OperationalRuntimeConfig, RecoveryRuntimeConfig, RuntimeSettingsService } from './runtime-settings.service';

describe('RuntimeSettingsService', () => {
  let service: RuntimeSettingsService;
  let http: HttpTestingController;
  const config: OperationalRuntimeConfig = {
    loginMaxFailedAttempts: 5,
    loginLockDurationMinutes: 15,
    heatTagHalveAfterDays: 14,
    heatTagExpireDays: 30,
    scoringMinCategorySample: 10,
    sceneAdoptConfidence: 0.5,
    sceneScoringConfidence: 0.7,
    calibrationMinSample: 200,
  };
  const recovery: RecoveryRuntimeConfig = {
    aiTaskRecoveryPollingEnabled: false,
    aiTaskRecoveryPollSeconds: 300,
    importPeriodicRecoveryEnabled: false,
    importRecoveryPollSeconds: 15,
    heatCatchUpEnabled: false,
    riskStartupRunEnabled: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RuntimeSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads operational settings from the SYS_ADMIN endpoint', () => {
    service.getOperationalConfig().subscribe((result) => expect(result).toEqual(config));

    const request = http.expectOne(`${environment.apiBaseUrl}/admin/operational-config`);
    expect(request.request.method).toBe('GET');
    expect(request.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    request.flush({ success: true, data: config });
  });

  it('updates operational settings as one audited configuration', () => {
    service.updateOperationalConfig(config).subscribe((result) => expect(result).toEqual(config));

    const request = http.expectOne(`${environment.apiBaseUrl}/admin/operational-config`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    expect(request.request.body).toEqual(config);
    request.flush({ success: true, data: config });
  });

  it('uses local loading indicators for AI settings and schedules', () => {
    service.getAiConfigOptions().subscribe();
    service.getSchedules().subscribe();

    const optionsRequest = http.expectOne(`${environment.apiBaseUrl}/admin/ai-config/options`);
    expect(optionsRequest.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    optionsRequest.flush({ success: true, data: { aliases: [], models: [], source: 'MISTRAL_API', warning: null } });

    const schedulesRequest = http.expectOne(`${environment.apiBaseUrl}/admin/schedules`);
    expect(schedulesRequest.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    schedulesRequest.flush({ success: true, data: { items: [] } });
  });

  it('loads and updates recovery settings with local loading', () => {
    service.getRecoveryConfig().subscribe((result) => expect(result).toEqual(recovery));
    const getRequest = http.expectOne(`${environment.apiBaseUrl}/admin/recovery-config`);
    expect(getRequest.request.method).toBe('GET');
    expect(getRequest.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    getRequest.flush({ success: true, data: recovery });

    service.updateRecoveryConfig(recovery).subscribe((result) => expect(result).toEqual(recovery));
    const putRequest = http.expectOne(`${environment.apiBaseUrl}/admin/recovery-config`);
    expect(putRequest.request.method).toBe('PUT');
    expect(putRequest.request.body).toEqual(recovery);
    expect(putRequest.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    putRequest.flush({ success: true, data: recovery });
  });
});
