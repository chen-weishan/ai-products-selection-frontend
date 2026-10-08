import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { OperationalRuntimeConfig, RuntimeSettingsService } from './runtime-settings.service';

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
    request.flush({ success: true, data: config });
  });

  it('updates operational settings as one audited configuration', () => {
    service.updateOperationalConfig(config).subscribe((result) => expect(result).toEqual(config));

    const request = http.expectOne(`${environment.apiBaseUrl}/admin/operational-config`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(config);
    request.flush({ success: true, data: config });
  });
});
