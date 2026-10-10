import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, finalize, forkJoin, of } from 'rxjs';
import {
  AiConfigOptions,
  AiRuntimeConfig,
  BudgetPoolSnapshot,
  BudgetSnapshot,
  ModelAliasInfo,
  ModelOption,
  RuntimeSettingsService,
} from '../runtime-settings.service';

/** 下拉中代表「手動輸入」的選項值；Mistral model ID 不可能含底線開頭的這串。 */
export const CUSTOM_MODEL = '__custom__';
const MODEL_ID = /^[A-Za-z0-9._:/-]{1,100}$/;

export interface RouteDraft {
  alias: string;
  info: ModelAliasInfo | null;
  /** 下拉選到的值；選「手動輸入」時為 CUSTOM_MODEL，實際名稱在 customPrimary。 */
  primaryChoice: string;
  customPrimary: string;
  fallbacks: string[];
  fallbackChoice: string | null;
  customFallback: string;
}

/** 比例以百分比編輯，存檔時再轉回 0～1。 */
export interface QuotaDraft {
  dailyQuota: number;
  trackAPercent: number;
  trackBPercent: number;
  retryPercent: number;
  warningPercent: number;
  rateLimitPerMinute: number;
  trendRateLimitPerMinute: number;
  batchItemCap: number;
  retryMax: number;
  timeoutSeconds: number;
  sourcingTimeoutSeconds: number;
  cacheDays: number;
  trendCacheDays: number;
  sourcingCacheDays: number;
}

const POOL_LABELS: Record<string, { label: string; hint: string }> = {
  TRACK_A: { label: 'A 軌批次池', hint: '每週選品 AI 分析' },
  TRACK_B: { label: 'B 軌探索池', hint: '尋源探索' },
  RETRY: { label: '重試／校準池', hint: '失敗重跑、臨時任務、季度校準' },
};

@Component({
  selector: 'app-admin-ai-settings',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSelectModule, MatSlideToggleModule, MatTooltipModule],
  templateUrl: './admin-ai-settings.component.html',
  styleUrls: ['../admin-shared.scss', './admin-ai-settings.component.scss'],
})
export class AdminAiSettingsComponent {
  private readonly api = inject(RuntimeSettingsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly customModel = CUSTOM_MODEL;
  readonly poolLabels = POOL_LABELS;
  readonly pools: { code: string; key: 'trackAPercent' | 'trackBPercent' | 'retryPercent' }[] = [
    { code: 'TRACK_A', key: 'trackAPercent' },
    { code: 'TRACK_B', key: 'trackBPercent' },
    { code: 'RETRY', key: 'retryPercent' },
  ];
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly options = signal<AiConfigOptions | null>(null);
  readonly budget = signal<BudgetSnapshot | null>(null);

  routes: RouteDraft[] = [];
  externalLlmEnabled = true;
  trendScheduleEnabled = true;
  quota: QuotaDraft | null = null;
  private saved: AiRuntimeConfig | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      config: this.api.getAiConfig(),
      options: this.api.getAiConfigOptions(),
      // 用量只是參考資訊，取不到不擋設定頁
      budget: this.api.getBudgets().pipe(catchError(() => of(null))),
    })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ config, options, budget }) => {
          this.options.set(options);
          this.budget.set(budget);
          this.reset(config);
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  reset(config: AiRuntimeConfig | null = this.saved): void {
    if (config == null) return;
    this.saved = structuredClone(config);
    this.externalLlmEnabled = config.externalLlmEnabled;
    this.trendScheduleEnabled = config.trendScheduleEnabled;
    const aliases = this.options()?.aliases ?? [];
    const order = aliases.map((alias) => alias.code);
    const codes = Object.keys(config.models).sort((a, b) => rank(order, a) - rank(order, b));
    this.routes = codes.map((alias) => {
      const route = config.models[alias];
      const listed = this.modelIds().includes(route.primary);
      return {
        alias,
        info: aliases.find((item) => item.code === alias) ?? null,
        primaryChoice: listed ? route.primary : CUSTOM_MODEL,
        customPrimary: listed ? '' : route.primary,
        fallbacks: [...route.fallbacks],
        fallbackChoice: null,
        customFallback: '',
      };
    });
    this.quota = {
      dailyQuota: config.dailyQuota,
      trackAPercent: toPercent(config.trackAShare),
      trackBPercent: toPercent(config.trackBShare),
      retryPercent: toPercent(config.retryShare),
      warningPercent: toPercent(config.warningRatio),
      rateLimitPerMinute: config.rateLimitPerMinute,
      trendRateLimitPerMinute: config.trendRateLimitPerMinute,
      batchItemCap: config.batchItemCap,
      retryMax: config.retryMax,
      timeoutSeconds: config.timeoutSeconds,
      sourcingTimeoutSeconds: config.sourcingTimeoutSeconds,
      cacheDays: config.cacheDays,
      trendCacheDays: config.trendCacheDays,
      sourcingCacheDays: config.sourcingCacheDays,
    };
  }

  modelIds(): string[] {
    return this.options()?.models.map((model) => model.id) ?? [];
  }

  modelOption(id: string): ModelOption | undefined {
    return this.options()?.models.find((model) => model.id === id);
  }

  primaryOf(route: RouteDraft): string {
    return (route.primaryChoice === CUSTOM_MODEL ? route.customPrimary : route.primaryChoice).trim();
  }

  /** 備援下拉只列還沒被選的模型。 */
  fallbackCandidates(route: RouteDraft): ModelOption[] {
    const used = new Set([this.primaryOf(route), ...route.fallbacks]);
    return (this.options()?.models ?? []).filter((model) => model.available && !used.has(model.id));
  }

  onFallbackChosen(route: RouteDraft, value: string | null): void {
    if (value == null || value === CUSTOM_MODEL) return;
    this.addFallback(route, value);
  }

  addFallback(route: RouteDraft, value: string): void {
    const model = value.trim();
    if (!model || model === this.primaryOf(route) || route.fallbacks.includes(model)) {
      route.fallbackChoice = null;
      return;
    }
    route.fallbacks = [...route.fallbacks, model];
    route.fallbackChoice = null;
    route.customFallback = '';
  }

  removeFallback(route: RouteDraft, index: number): void {
    route.fallbacks = route.fallbacks.filter((_, i) => i !== index);
  }

  moveFallback(route: RouteDraft, index: number, delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= route.fallbacks.length) return;
    const next = [...route.fallbacks];
    [next[index], next[target]] = [next[target], next[index]];
    route.fallbacks = next;
  }

  routeError(route: RouteDraft): string | null {
    const primary = this.primaryOf(route);
    if (!primary) return '請選擇主要模型';
    if (!MODEL_ID.test(primary)) return '模型名稱只能包含英數字與 . _ : / -，不可有空白';
    const unsupported = this.options()?.source === 'MISTRAL_API'
      ? [primary, ...route.fallbacks].filter((id) => this.modelOption(id)?.available === false)
      : [];
    if (unsupported.length) return `${unsupported.join('、')} 未通過 reasoning=true 驗證`;
    return null;
  }

  /** 手動輸入的未知模型由後端在存檔時向 Mistral 驗證。 */
  unavailableModels(route: RouteDraft): string[] {
    if (this.options() == null) return [];
    return [this.primaryOf(route), ...route.fallbacks]
      .filter((id) => id && MODEL_ID.test(id) && !this.modelOption(id)?.available);
  }

  shareTotal(): number {
    if (this.quota == null) return 0;
    return round1(this.quota.trackAPercent + this.quota.trackBPercent + this.quota.retryPercent);
  }

  poolLimit(percent: number): number {
    return Math.floor(((this.quota?.dailyQuota ?? 0) * percent) / 100);
  }

  todayPool(code: string): BudgetPoolSnapshot | undefined {
    return this.budget()?.pools.find((pool) => pool.pool === code);
  }

  usagePercent(pool: BudgetPoolSnapshot | undefined): number {
    if (pool == null || pool.limit <= 0) return 0;
    return Math.min(100, Math.round((pool.used / pool.limit) * 100));
  }

  quotaErrors(): string[] {
    const quota = this.quota;
    if (quota == null) return [];
    const errors: string[] = [];
    if (Math.abs(this.shareTotal() - 100) > 0.01) errors.push(`三個預算池合計須為 100%，目前為 ${this.shareTotal()}%`);
    if ([quota.trackAPercent, quota.trackBPercent, quota.retryPercent].some((v) => v == null || v < 0)) {
      errors.push('預算池比例不可為負數');
    }
    if (!(quota.warningPercent > 0 && quota.warningPercent < 100)) errors.push('用量警示須介於 1%～99%');
    if (!(quota.dailyQuota >= 0)) errors.push('每日總配額不可為負數');
    if (!(quota.rateLimitPerMinute >= 1) || !(quota.trendRateLimitPerMinute >= 1)) errors.push('每分鐘請求上限至少為 1');
    if (!(quota.batchItemCap >= 1)) errors.push('單輪品項上限至少為 1');
    if (!(quota.retryMax >= 0)) errors.push('重試次數不可為負數');
    if (!(quota.timeoutSeconds >= 1) || !(quota.sourcingTimeoutSeconds >= 1)) errors.push('逾時秒數至少為 1');
    if ([quota.cacheDays, quota.trendCacheDays, quota.sourcingCacheDays].some((v) => !(v >= 0))) {
      errors.push('快取天數不可為負數');
    }
    return errors;
  }

  canSave(): boolean {
    return !this.saving()
      && this.routes.every((route) => this.routeError(route) == null)
      && this.quotaErrors().length === 0;
  }

  isDirty(): boolean {
    const request = this.buildRequest();
    return request != null && this.saved != null && JSON.stringify(request) !== JSON.stringify(normalize(this.saved));
  }

  save(): void {
    const request = this.buildRequest();
    if (request == null || !this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.updateAiConfig(request)
      .pipe(finalize(() => this.saving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.reset(saved);
          this.success.set('AI 設定已儲存，後續的 AI 任務立即採用新設定（不需重啟）。');
          this.refreshBudget();
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  private refreshBudget(): void {
    this.api.getBudgets()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe((budget) => this.budget.set(budget));
  }

  buildRequest(): AiRuntimeConfig | null {
    const quota = this.quota;
    if (quota == null) return null;
    return normalize({
      models: Object.fromEntries(this.routes.map((route) => [route.alias, {
        primary: this.primaryOf(route),
        fallbacks: route.fallbacks,
      }])),
      externalLlmEnabled: this.externalLlmEnabled,
      trendScheduleEnabled: this.trendScheduleEnabled,
      dailyQuota: quota.dailyQuota,
      trackAShare: quota.trackAPercent / 100,
      trackBShare: quota.trackBPercent / 100,
      retryShare: quota.retryPercent / 100,
      warningRatio: quota.warningPercent / 100,
      rateLimitPerMinute: quota.rateLimitPerMinute,
      trendRateLimitPerMinute: quota.trendRateLimitPerMinute,
      batchItemCap: quota.batchItemCap,
      retryMax: quota.retryMax,
      timeoutSeconds: quota.timeoutSeconds,
      sourcingTimeoutSeconds: quota.sourcingTimeoutSeconds,
      cacheDays: quota.cacheDays,
      trendCacheDays: quota.trendCacheDays,
      sourcingCacheDays: quota.sourcingCacheDays,
    });
  }
}

function toPercent(ratio: number): number {
  return round1(ratio * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function rank(order: string[], code: string): number {
  const index = order.indexOf(code);
  return index < 0 ? order.length : index;
}

/** 比較 dirty 用：比例四捨五入到千分位，避免 0.7 與 0.7000000001 被當成有改。 */
function normalize(config: AiRuntimeConfig): AiRuntimeConfig {
  const fix = (value: number) => Math.round(value * 1000) / 1000;
  const models = Object.fromEntries(Object.keys(config.models).sort().map((alias) => [alias, config.models[alias]]));
  return {
    models,
    externalLlmEnabled: config.externalLlmEnabled,
    trendScheduleEnabled: config.trendScheduleEnabled,
    dailyQuota: config.dailyQuota,
    trackAShare: fix(config.trackAShare),
    trackBShare: fix(config.trackBShare),
    retryShare: fix(config.retryShare),
    warningRatio: fix(config.warningRatio),
    rateLimitPerMinute: config.rateLimitPerMinute,
    trendRateLimitPerMinute: config.trendRateLimitPerMinute,
    batchItemCap: config.batchItemCap,
    retryMax: config.retryMax,
    timeoutSeconds: config.timeoutSeconds,
    sourcingTimeoutSeconds: config.sourcingTimeoutSeconds,
    cacheDays: config.cacheDays,
    trendCacheDays: config.trendCacheDays,
    sourcingCacheDays: config.sourcingCacheDays,
  };
}
