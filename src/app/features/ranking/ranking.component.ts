import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ScoreService } from './score.service';
import { WeightVersionService } from '../weights/weight-version.service';
import {
  FACTOR_CODES,
  FACTOR_LABELS,
  SCENE_TYPES,
  SceneType,
  WeightVersionDetail,
  WeightVersionSummary,
} from '../../core/models/weight';
import {
  PENALTY_FACTOR_LABELS,
  SCENE_BOARD_LABELS,
  ScoreDeductions,
  ScoreFactorBar,
  ScoreRankingRow,
} from '../../core/models/score';

const PAGE_SIZE = 20;

/**
 * S-05 選品分數排行（FR-04）。版面依「畫面功能示意圖 v3.0」。
 *
 * 示意圖中的「本榜分級分布卡」對應 GET /scores/ranking/summary，後端尚無此端點；
 * 示意圖自己也註明前端不可用當頁列數自行加總，所以不呈現而非湊數。
 * 「類別」篩選同理：後端只吃 categoryId，但目前沒有品類清單端點可供選單。
 */
@Component({
  selector: 'app-ranking',
  imports: [RouterLink],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.scss',
})
export class RankingComponent implements OnInit {
  private scores = inject(ScoreService);
  private weights = inject(WeightVersionService);

  readonly sceneTypes = SCENE_TYPES;
  readonly factorCodes = FACTOR_CODES;
  readonly factorLabels = FACTOR_LABELS;
  readonly boardLabels = SCENE_BOARD_LABELS;
  readonly penaltyLabels = PENALTY_FACTOR_LABELS;

  /** 因子長條的固定順序說明文字，與表格下方的圖例一致。 */
  readonly factorOrderText = FACTOR_CODES.map((c) => FACTOR_LABELS[c]).join(' · ');

  readonly period = signal(currentIsoWeek());
  readonly scene = signal<SceneType>('VIRAL');
  readonly page = signal(0);

  readonly rows = signal<ScoreRankingRow[]>([]);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);

  /** 四榜各自的總筆數，供分頁列顯示。尚未載入或載入失敗時該榜沒有數字。 */
  readonly counts = signal<Partial<Record<SceneType, number>>>({});

  readonly activeVersion = signal<WeightVersionDetail | null>(null);
  readonly draftVersions = signal<WeightVersionSummary[]>([]);
  readonly simulateVersionId = signal<number | null>(null);

  /** 非 null 代表目前顯示的是試算結果，不是資料庫既有分數。 */
  readonly simulated = signal<ScoreRankingRow[] | null>(null);

  readonly deductions = signal<ScoreDeductions | null>(null);
  readonly deductionsOf = signal<string | null>(null);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** 表格實際渲染的資料：試算中看試算結果，否則看分頁結果。 */
  readonly displayRows = computed(() => this.simulated() ?? this.rows());

  /** 本榜權重列：目前生效版本裡對應這一榜的六因子權重。 */
  readonly sceneWeights = computed(() => {
    const version = this.activeVersion();
    if (!version) return null;
    return version.sceneGroups.find((g) => g.sceneType === this.scene()) ?? null;
  });

  /** input type="week" 用的值：後端存 2026W30，控制項要 2026-W30。 */
  readonly periodInputValue = computed(() => toWeekInput(this.period()));

  ngOnInit(): void {
    this.loadWeightVersions();
    this.reload();
  }

  // ── 讀取 ────────────────────────────────────────────────────

  /** 換榜、換期別、換頁都走這裡。試算結果在任何條件變動時作廢。 */
  reload(): void {
    const period = this.period();
    if (!period) return;

    this.simulated.set(null);
    this.clearDeductions();
    this.errorMessage.set(null);
    this.loading.set(true);

    this.scores.ranking(period, this.scene(), null, this.page(), PAGE_SIZE).subscribe({
      next: (result) => {
        this.rows.set(result.content);
        this.totalElements.set(result.totalElements);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (err) => this.fail(err),
    });

    this.loadCounts(period);
  }

  /**
   * 四榜的總筆數。各打一次 size=1 只為了拿 totalElements——
   * 分頁列的數字是全榜彙總，不能用當頁列數推。
   */
  private loadCounts(period: string): void {
    forkJoin(SCENE_TYPES.map((s) => this.scores.ranking(period, s, null, 0, 1))).subscribe({
      next: (pages) => {
        const next: Partial<Record<SceneType, number>> = {};
        SCENE_TYPES.forEach((s, i) => (next[s] = pages[i].totalElements));
        this.counts.set(next);
      },
      // 筆數只是輔助資訊，失敗時讓分頁列不顯示數字即可，不要蓋掉主清單
      error: () => this.counts.set({}),
    });
  }

  private loadWeightVersions(): void {
    this.weights.getActive().subscribe({
      next: (detail) => this.activeVersion.set(detail),
      // 沒有生效中的版本時後端回 404，本榜權重列不顯示即可，不是錯誤畫面
      error: () => this.activeVersion.set(null),
    });

    this.weights.list(0, 50).subscribe({
      next: (result) => {
        const drafts = result.content.filter((v) => v.status === 'DRAFT');
        this.draftVersions.set(drafts);
        this.simulateVersionId.set(drafts[0]?.id ?? null);
      },
      error: () => this.draftVersions.set([]),
    });
  }

  // ── 篩選 ────────────────────────────────────────────────────

  selectScene(scene: SceneType): void {
    if (this.scene() === scene) return;
    this.scene.set(scene);
    this.page.set(0);
    this.reload();
  }

  /** 控制項給的是 2026-W30，後端要 2026W30。清空時不打 API。 */
  setPeriod(value: string): void {
    if (!value) return;
    this.period.set(value.replace('-', ''));
    this.page.set(0);
    this.reload();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.page.set(page);
    this.reload();
  }

  // ── 試算 ────────────────────────────────────────────────────

  setSimulateVersion(value: string): void {
    const id = Number(value);
    this.simulateVersionId.set(Number.isFinite(id) ? id : null);
  }

  /** 以草稿權重重算本榜。結果不寫入資料庫，換條件即消失。 */
  simulate(): void {
    const versionId = this.simulateVersionId();
    if (versionId == null) return;

    this.clearDeductions();
    this.errorMessage.set(null);
    this.loading.set(true);

    this.scores
      .simulate({
        weightVersionId: versionId,
        period: this.period(),
        scene: this.scene(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (result) => {
          this.simulated.set(result);
          this.loading.set(false);
        },
        error: (err) => this.fail(err),
      });
  }

  exitSimulation(): void {
    this.simulated.set(null);
    this.clearDeductions();
  }

  simulatedVersionNo(): string {
    const id = this.simulateVersionId();
    return this.draftVersions().find((v) => v.id === id)?.versionNo ?? '草稿';
  }

  // ── 扣分明細 ────────────────────────────────────────────────

  /** 點列展開扣分明細。沒有扣分的列不打 API。 */
  showDeductions(row: ScoreRankingRow): void {
    if (row.penaltySubtotal <= 0) {
      this.clearDeductions();
      return;
    }
    this.deductionsOf.set(row.productName);
    this.scores.deductions(row.scoreId).subscribe({
      next: (result) => this.deductions.set(result),
      error: (err) => this.fail(err),
    });
  }

  private clearDeductions(): void {
    this.deductions.set(null);
    this.deductionsOf.set(null);
  }

  // ── 顯示格式 ────────────────────────────────────────────────

  /**
   * 因子長條依 FACTOR_CODES 固定排序，缺的因子補一根無資料的空條。
   * 後端回的順序不保證，照回傳順序畫會讓每一列的第幾根代表不同因子。
   */
  orderedFactors(row: ScoreRankingRow): ScoreFactorBar[] {
    const byCode = new Map(row.factors.map((f) => [f.factorCode, f]));
    return FACTOR_CODES.map(
      (code) =>
        byCode.get(code) ?? {
          factorCode: code,
          normalizedValue: null,
          weight: null,
          dataAvailable: false,
          imputed: false,
        },
    );
  }

  /**
   * 分頁列上的筆數。回字串是為了讓 0 也顯示得出來——
   * 樣板用 @if 判斷，回 number 時 0 會被當 falsy 而整個數字消失。
   * 尚未載入或載入失敗時回 null，該榜就不顯示數字。
   */
  countOf(scene: SceneType): string | null {
    const n = this.counts()[scene];
    return n == null ? null : String(n);
  }

  /** 名次以 1 起算，跨頁累加。試算結果只有一頁，故從 1 起算。 */
  rankNo(index: number): string {
    const base = this.simulated() ? 0 : this.page() * PAGE_SIZE;
    return String(base + index + 1).padStart(2, '0');
  }

  /** 0.075 → "7.5%"。四捨五入避開浮點誤差（0.08 * 100 = 8.000000000000002）。 */
  percent(value: number | null | undefined): string {
    if (value == null) return '—';
    return `${Math.round(value * 1000) / 10}%`;
  }

  /** 分數去掉無意義的尾零：94.00 → 94，86.89 維持 86.89。 */
  score(value: number | null | undefined): string {
    if (value == null) return '—';
    return String(Math.round(value * 100) / 100);
  }

  /** 長條寬度。0–100 的正規化值直接當百分比，無資料回 0。 */
  barWidth(value: number | null | undefined): string {
    if (value == null) return '0%';
    return `${Math.min(100, Math.max(0, value))}%`;
  }

  /**
   * 風險點：扣分達硬規則門檻的列標紅，有扣分但未達門檻標琥珀。
   * riskSuppressed 由後端依 §5.6 判定，前端不自己比門檻值。
   */
  riskLevel(row: ScoreRankingRow): 'high' | 'mid' | 'none' {
    if (row.riskSuppressed) return 'high';
    return row.penaltySubtotal > 0 ? 'mid' : 'none';
  }

  // ── 共用 ────────────────────────────────────────────────────

  /** 後端統一錯誤封套（§8.1）：優先顯示 error.message。 */
  private fail(err: unknown): void {
    this.loading.set(false);
    if (err instanceof HttpErrorResponse) {
      const apiError = err.error?.error;
      if (apiError?.message) {
        this.errorMessage.set(apiError.message);
        return;
      }
      this.errorMessage.set(`請求失敗（HTTP ${err.status}）。`);
      return;
    }
    this.errorMessage.set('請求失敗。');
  }
}

/** 2026W30 → 2026-W30，供 input type="week" 使用。格式不符時回空字串。 */
function toWeekInput(period: string): string {
  return /^\d{4}W\d{2}$/.test(period) ? `${period.slice(0, 4)}-${period.slice(4)}` : '';
}

/**
 * 目前的 ISO 週，格式 2026W30。
 *
 * ISO 8601 的規則是「含當年第一個星期四的那一週為第 1 週」，
 * 所以要先把日期挪到該週的星期四再比對年初，不能直接拿日數除以 7。
 */
function currentIsoWeek(): string {
  const now = new Date();
  const thursday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  // getUTCDay() 星期日為 0，ISO 以星期一為 1、星期日為 7
  const isoDay = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - isoDay);

  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}W${String(week).padStart(2, '0')}`;
}
