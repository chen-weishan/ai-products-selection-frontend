import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AiRuntimeConfig, RuntimeSettingsService } from '../runtime-settings.service';
import { AdminAiSettingsComponent, CUSTOM_MODEL } from './admin-ai-settings.component';

describe('AdminAiSettingsComponent', () => {
  let fixture: ComponentFixture<AdminAiSettingsComponent>;
  let component: AdminAiSettingsComponent;
  const config: AiRuntimeConfig = {
    models: {
      MODEL_NUMERIC: { primary: 'mistral-small-latest', fallbacks: ['mistral-medium-3-5'] },
      MODEL_CLASSIFY: { primary: 'my-private-model', fallbacks: [] },
    },
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
  };
  const api = {
    getAiConfig: vi.fn(),
    getAiConfigOptions: vi.fn(),
    getBudgets: vi.fn(),
    updateAiConfig: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getAiConfig.mockReturnValue(of(structuredClone(config)));
    api.getAiConfigOptions.mockReturnValue(of({
      aliases: [
        { code: 'MODEL_CLASSIFY', label: '情境判定', description: '', agents: ['SceneClassifierAgent'] },
        { code: 'MODEL_NUMERIC', label: '數值判讀', description: '', agents: ['TrendInterpreterAgent'] },
      ],
      models: [
        { id: 'mistral-medium-3-5', available: true, inUse: true },
        { id: 'mistral-small-latest', available: true, inUse: true },
        { id: 'magistral-medium-latest', available: true, inUse: false },
        { id: 'my-private-model', available: false, inUse: true },
      ],
      source: 'MISTRAL_API',
      warning: null,
    }));
    api.getBudgets.mockReturnValue(of({
      dailyQuota: 1000, resetAt: '', resetSource: '',
      pools: [{ pool: 'TRACK_A', share: 0.7, limit: 700, used: 600, cacheHits: 3, status: 'WARNING' }],
    }));
    api.updateAiConfig.mockImplementation((request: AiRuntimeConfig) => of(request));

    await TestBed.configureTestingModule({
      imports: [AdminAiSettingsComponent],
      providers: [{ provide: RuntimeSettingsService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminAiSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('orders aliases by the server definition and shows shares as percentages', () => {
    expect(component.routes.map((route) => route.alias)).toEqual(['MODEL_CLASSIFY', 'MODEL_NUMERIC']);
    expect(component.routes[0].info?.label).toBe('情境判定');
    expect(component.quota?.trackAPercent).toBe(70);
    expect(component.isDirty()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('今日已用 600 / 700 次');
  });

  it('offers only unused models as fallback candidates and adds them in order', () => {
    const numeric = component.routes[1];
    expect(component.fallbackCandidates(numeric).map((model) => model.id))
      .toEqual(['magistral-medium-latest', 'my-private-model']);

    component.onFallbackChosen(numeric, 'magistral-medium-latest');
    component.moveFallback(numeric, 1, -1);

    expect(numeric.fallbacks).toEqual(['magistral-medium-latest', 'mistral-medium-3-5']);
    expect(component.isDirty()).toBe(true);
  });

  it('supports a manually typed primary model and rejects invalid names', () => {
    const numeric = component.routes[1];
    numeric.primaryChoice = CUSTOM_MODEL;
    numeric.customPrimary = 'bad model';
    expect(component.routeError(numeric)).toContain('不可有空白');
    expect(component.canSave()).toBe(false);

    numeric.customPrimary = 'ministral-8b-latest';
    expect(component.routeError(numeric)).toBeNull();
    expect(component.unavailableModels(numeric)).toEqual(['ministral-8b-latest']);
  });

  it('blocks saving until the three pools add up to 100%', () => {
    component.quota!.trackAPercent = 60;
    expect(component.quotaErrors()[0]).toContain('目前為 90%');
    expect(component.canSave()).toBe(false);
  });

  it('saves percentages back as ratios with the edited model routes', () => {
    component.routes[1].primaryChoice = 'magistral-medium-latest';
    component.quota!.trackAPercent = 60;
    component.quota!.trackBPercent = 30;

    component.save();

    const request = api.updateAiConfig.mock.calls[0][0] as AiRuntimeConfig;
    expect(request.models['MODEL_NUMERIC'].primary).toBe('magistral-medium-latest');
    expect(request.models['MODEL_CLASSIFY'].primary).toBe('my-private-model');
    expect(request.trackAShare).toBe(0.6);
    expect(request.trackBShare).toBe(0.3);
    expect(component.isDirty()).toBe(false);
    expect(component.success()).toContain('立即採用');
  });
});
