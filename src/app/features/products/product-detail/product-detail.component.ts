import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import {
  DeductionItem,
  ProductControllerService,
  ProductInsightResponse,
  ProductInsightService,
  ProductResponse,
  ProductScoresService,
  ProductScenesService,
  RecommendationControllerService,
  RecommendationResponse,
  ReviewRiskControllerService,
  ReviewRiskResponse,
  SceneClassificationResponse,
  ScoreDetailResponse,
  ScoreFactorDetailResponse,
} from '../../../api';
import { AuthService } from '../../../core/auth/auth.service';
import { DECISION_LABELS, Decision, DecisionType } from '../../../core/models/decision';
import {
  CreateDecisionDialogComponent,
  CreateDecisionDialogData,
} from '../../decisions/create-decision-dialog/create-decision-dialog.component';

type SceneType = 'VIRAL' | 'FESTIVAL' | 'REPLENISHMENT' | 'SEASONAL';
type FactorCode = 'TREND' | 'MARGIN' | 'CVR' | 'PRICE_FIT' | 'FESTIVAL' | 'CLIMATE';
type PenaltyCode = 'REVIEW_RISK' | 'LOGISTICS_RISK' | 'INVENTORY_RISK';

interface FactorRow {
  code: FactorCode;
  label: string;
  detail?: ScoreFactorDetailResponse;
}

interface PenaltyRow {
  code: PenaltyCode;
  label: string;
  detail?: DeductionItem;
}

@Component({
  selector: 'app-product-detail',
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly productService = inject(ProductControllerService);
  private readonly scoreService = inject(ProductScoresService);
  private readonly sceneService = inject(ProductScenesService);
  private readonly insightService = inject(ProductInsightService);
  private readonly reviewRiskService = inject(ReviewRiskControllerService);
  private readonly recommendationService = inject(RecommendationControllerService);

  readonly productId = signal<number | null>(null);
  readonly period = signal(currentIsoWeek());
  readonly product = signal<ProductResponse | null>(null);
  readonly score = signal<ScoreDetailResponse | null>(null);
  readonly scene = signal<SceneClassificationResponse | null>(null);
  readonly insight = signal<ProductInsightResponse | null>(null);
  readonly reviewRisk = signal<ReviewRiskResponse | null>(null);
  readonly recommendation = signal<RecommendationResponse | null>(null);
  readonly selectedScene = signal<SceneType | null>(null);
  readonly loading = signal(false);
  readonly scoreLoading = signal(false);
  readonly actionLoading = signal(false);
  readonly overrideOpen = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly sectionWarnings = signal<string[]>([]);

  readonly sceneLabels: Record<SceneType, string> = {
    VIRAL: '話題爆款型',
    FESTIVAL: '節慶檔期型',
    REPLENISHMENT: '常態補貨型',
    SEASONAL: '季節導向型',
  };

  readonly productStatusLabels: Record<ProductResponse.StatusEnum, string> = {
    DRAFT: '草稿',
    EVALUATING: '待評估',
    WATCHING: '觀察中',
    ADOPTED: '已採納',
    LISTED: '已上架',
    REJECTED: '已淘汰',
  };

  readonly sceneOptions = (Object.keys(this.sceneLabels) as SceneType[]).map((value) => ({
    value,
    label: this.sceneLabels[value],
  }));

  readonly overrideForm = new FormGroup({
    sceneType: new FormControl<SceneType | null>(null, Validators.required),
    reason: new FormControl('', [Validators.required, Validators.maxLength(255)]),
  });

  readonly canOverride = computed(() =>
    this.authService.hasRole(['BUYER', 'BUYER_LEAD', 'SYS_ADMIN']),
  );
  readonly canOperateDecision = computed(() =>
    this.authService.hasRole(['BUYER', 'BUYER_LEAD', 'SYS_ADMIN']),
  );

  readonly effectivePrimaryScene = computed<SceneType | null>(() => {
    const result = this.scene();
    if (!result) return null;
    if (result.fallbackApplied || (result.confidence ?? 0) < 0.5) return 'REPLENISHMENT';
    return result.sceneType ?? null;
  });

  readonly confidenceState = computed<'normal' | 'low' | 'fallback'>(() => {
    const result = this.scene();
    if (!result || result.fallbackApplied || (result.confidence ?? 0) < 0.5) return 'fallback';
    return (result.confidence ?? 0) < 0.7 ? 'low' : 'normal';
  });

  readonly factorRows = computed<FactorRow[]>(() => {
    const labels: Array<[FactorCode, string]> = [
      ['TREND', '社群熱度斜率'],
      ['MARGIN', '毛利率'],
      ['CVR', '歷史轉換率'],
      ['PRICE_FIT', '價格帶適配度'],
      ['FESTIVAL', '節慶時間窗'],
      ['CLIMATE', '季節氣候適配'],
    ];
    const details = this.score()?.bonusFactors ?? [];
    return labels.map(([code, label]) => ({
      code,
      label,
      detail: details.find((item) => item.factorCode === code),
    }));
  });

  readonly penaltyRows = computed<PenaltyRow[]>(() => {
    const labels: Array<[PenaltyCode, string]> = [
      ['REVIEW_RISK', '評論風險'],
      ['LOGISTICS_RISK', '物流風險'],
      ['INVENTORY_RISK', '庫存風險'],
    ];
    const details = this.score()?.penaltyFactors ?? [];
    return labels.map(([code, label]) => ({
      code,
      label,
      detail: details.find((item) => item.factorCode === code),
    }));
  });

  readonly reviewPenalty = computed(
    () =>
      this.score()?.penaltyFactors?.find((item) => item.factorCode === 'REVIEW_RISK')
        ?.penaltyValue ?? 0,
  );

  readonly sentiment = computed(() => {
    const reviews = this.reviewRisk()?.reviews ?? [];
    const total = reviews.length;
    const count = (value: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE') =>
      reviews.filter((review) => review.sentiment === value).length;
    const percent = (value: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE') =>
      total ? Math.round((count(value) / total) * 100) : 0;
    return {
      total,
      positive: percent('POSITIVE'),
      neutral: percent('NEUTRAL'),
      negative: percent('NEGATIVE'),
    };
  });

  ngOnInit(): void {
    const rawId = this.route.snapshot.paramMap.get('id');
    const id = Number(rawId);
    const queryPeriod = this.route.snapshot.queryParamMap.get('period');
    if (!rawId || !Number.isInteger(id) || id <= 0) {
      this.errorMessage.set('品項編號無效，請返回列表重新選擇。');
      return;
    }
    if (queryPeriod && /^\d{4}W\d{2}$/.test(queryPeriod)) this.period.set(queryPeriod);
    this.productId.set(id);
    this.loadDetail();
  }

  loadDetail(): void {
    const id = this.productId();
    if (!id) return;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.sectionWarnings.set([]);

    forkJoin({
      product: this.productService.getById({ id }).pipe(
        map((response) => response.data ?? null),
        catchError(() => {
          this.addWarning('品項基本資料載入失敗');
          return of(null);
        }),
      ),
      scene: this.sceneService
        .latest2({ productId: id }, 'body', false, {
          httpHeaderAccept: 'application/json' as never,
        })
        .pipe(
          map((response) => response.data ?? null),
          catchError(() => {
            this.addWarning('AI 情境判定尚無資料');
            return of(null);
          }),
        ),
      score: this.scoreService
        .snapshot({ id, period: this.period() }, 'body', false, {
          httpHeaderAccept: 'application/json' as never,
        })
        .pipe(
          map((response) => response.data ?? null),
          catchError(() => {
            this.addWarning(`評分週期 ${this.period()} 尚無正式快照`);
            return of(null);
          }),
        ),
      insight: this.insightService
        .latest5({ productId: id }, 'body', false, {
          httpHeaderAccept: 'application/json' as never,
        })
        .pipe(
          map((response) => response.data ?? null),
          catchError(() => {
            this.addWarning('AI 賣點與風險分析尚無結果');
            return of(null);
          }),
        ),
      reviewRisk: this.reviewRiskService
        .latest3({ productId: id }, 'body', false, {
          httpHeaderAccept: 'application/json' as never,
        })
        .pipe(
          map((response) => response.data ?? null),
          catchError(() => {
            this.addWarning('評論情緒分析尚無結果');
            return of(null);
          }),
        ),
      recommendation: this.recommendationService
        .latest4({ productId: id }, 'body', false, {
          httpHeaderAccept: 'application/json' as never,
        })
        .pipe(
          map((response) => response.data ?? null),
          catchError(() => {
            this.addWarning('AI 進貨建議尚無結果');
            return of(null);
          }),
        ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        this.product.set(data.product);
        this.scene.set(data.scene);
        this.score.set(data.score);
        this.insight.set(data.insight);
        this.reviewRisk.set(data.reviewRisk);
        this.recommendation.set(data.recommendation);
        this.selectedScene.set(
          data.score?.sceneType ??
            (data.scene?.fallbackApplied || (data.scene?.confidence ?? 0) < 0.5
              ? 'REPLENISHMENT'
              : (data.scene?.sceneType ?? null)),
        );
        if (!data.product) this.errorMessage.set('無法載入品項基本資料。');
        this.loading.set(false);
      });
  }

  selectScene(scene: SceneType): void {
    if (scene === this.selectedScene() || this.scoreLoading()) return;
    this.loadScore(scene);
  }

  openOverride(): void {
    const current = this.effectivePrimaryScene();
    this.overrideForm.reset({ sceneType: current, reason: '' });
    this.overrideOpen.set(true);
    this.successMessage.set(null);
  }

  cancelOverride(): void {
    this.overrideOpen.set(false);
    this.overrideForm.reset();
  }

  submitOverride(): void {
    const id = this.productId();
    const sceneType = this.overrideForm.controls.sceneType.value;
    const reason = this.overrideForm.controls.reason.value?.trim() ?? '';
    if (!id || !sceneType || !reason || this.overrideForm.invalid) {
      this.overrideForm.markAllAsTouched();
      return;
    }

    this.actionLoading.set(true);
    this.sceneService
      .override({ productId: id, sceneOverrideRequest: { sceneType, reason } }, 'body', false, {
        httpHeaderAccept: 'application/json' as never,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.overrideOpen.set(false);
          this.successMessage.set('情境覆寫已儲存，分數已依新權重組重算。');
          this.actionLoading.set(false);
          this.refreshSceneAndScore(sceneType);
        },
        error: () => {
          this.errorMessage.set('情境覆寫失敗，請確認權限與理由後重試。');
          this.actionLoading.set(false);
        },
      });
  }

  openDecision(initialDecision?: DecisionType): void {
    const id = this.productId();
    if (!id || this.actionLoading() || !this.canOperateDecision()) return;
    const data: CreateDecisionDialogData = { productId: id, initialDecision };
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.dialog
      .open(CreateDecisionDialogComponent, { data, maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((created: Decision | undefined) => {
        if (created) {
          const current = this.product();
          if (current) {
            this.product.set({
              ...current,
              status: created.productStatus as ProductResponse.StatusEnum,
            });
          }
          this.successMessage.set(
            `已建立${DECISION_LABELS[created.decision]}決策，決策快照已鎖定。`,
          );
        }
      });
  }

  factorPercent(detail?: ScoreFactorDetailResponse): number {
    if (!detail?.dataAvailable || detail.normalizedValue == null) return 0;
    const value =
      detail.normalizedValue <= 1 ? detail.normalizedValue * 100 : detail.normalizedValue;
    return Math.max(0, Math.min(100, value));
  }

  formatFactorRaw(row: FactorRow): string {
    const value = row.detail?.rawValue;
    if (value == null || row.detail?.dataAvailable === false) return '無資料';
    if (row.code === 'TREND') return formatPercentValue(value, true);
    if (row.code === 'MARGIN' || row.code === 'CVR') return formatPercentValue(value);
    return value.toFixed(2);
  }

  formatPercentile(detail?: ScoreFactorDetailResponse): string {
    if (!detail?.dataAvailable || detail.normalizedValue == null) return '—';
    return `P${Math.round(this.factorPercent(detail))}`;
  }

  formatConfidence(value: number | undefined): string {
    if (value == null) return '—';
    return value <= 1 ? value.toFixed(2) : (value / 100).toFixed(2);
  }

  productStatusLabel(status: ProductResponse.StatusEnum | undefined): string {
    return status ? this.productStatusLabels[status] : '未設定';
  }

  formatPenalty(detail?: DeductionItem): string {
    return (detail?.penaltyValue ?? 0).toFixed(1);
  }

  formatDate(value: string | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-TW');
  }

  recommendationActionLabel(action: RecommendationResponse.ActionEnum | undefined): string {
    const labels: Record<string, string> = {
      ADOPT: '建議採納',
      WATCH: '建議觀察',
      REJECT: '建議淘汰',
    };
    return action ? (labels[action] ?? action) : 'AI 進貨建議';
  }

  topicLabel(topic: string | undefined): string {
    const labels: Record<string, string> = {
      QUALITY: '品質',
      FOOD_SAFETY: '食品安全',
      SHIPPING_DAMAGE: '包裝／運送破損',
      PRICE: '價格',
      OTHER: '其他',
    };
    return topic ? (labels[topic] ?? topic) : '未分類';
  }

  formatLogistics(conditions: Set<ProductResponse.LogisticsConditionsEnum> | undefined): string {
    if (!conditions?.size) return '未指定';
    const labels: Record<string, string> = {
      NORMAL: '常溫',
      CHILLED: '冷藏',
      FROZEN: '冷凍',
      FRAGILE: '易碎',
      MELTABLE: '易融化',
      OVERSIZED: '大型材積',
    };
    return Array.from(conditions)
      .map((condition) => labels[condition] ?? condition)
      .join('、');
  }

  goBack(): void {
    this.router.navigate(['/products']);
  }

  private loadScore(scene: SceneType): void {
    const id = this.productId();
    if (!id) return;
    this.scoreLoading.set(true);
    this.errorMessage.set(null);
    this.scoreService
      .snapshot({ id, period: this.period(), scene }, 'body', false, {
        httpHeaderAccept: 'application/json' as never,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.score.set(response.data ?? null);
          this.selectedScene.set(scene);
          this.scoreLoading.set(false);
        },
        error: () => {
          this.errorMessage.set(`${this.sceneLabels[scene]}在 ${this.period()} 尚無分數快照。`);
          this.scoreLoading.set(false);
        },
      });
  }

  private refreshSceneAndScore(scene: SceneType): void {
    const id = this.productId();
    if (!id) return;
    this.sceneService
      .latest2({ productId: id }, 'body', false, { httpHeaderAccept: 'application/json' as never })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (response) => this.scene.set(response.data ?? null) });
    this.loadScore(scene);
  }

  private addWarning(message: string): void {
    this.sectionWarnings.update((warnings) =>
      warnings.includes(message) ? warnings : [...warnings, message],
    );
  }
}

function currentIsoWeek(date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}W${String(week).padStart(2, '0')}`;
}

function formatPercentValue(value: number, signed = false): string {
  const normalized = Math.abs(value) <= 10 ? value * 100 : value;
  const prefix = signed && normalized > 0 ? '+' : '';
  return `${prefix}${Number(normalized.toFixed(1))}%`;
}
