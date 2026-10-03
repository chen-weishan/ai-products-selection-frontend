import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CalibrationService } from './calibration.service';
import { WeightVersionService } from '../weights/weight-version.service';
import { DialogService } from '../../services/dialog-service';
import {
  FACTOR_CODES,
  FACTOR_LABELS,
  FactorCode,
  SCENE_LABELS,
  SCENE_TYPES,
  STATUS_LABELS,
  SceneType,
  WeightVersionSummary,
} from '../../core/models/weight';
import {
  BacktestComparison,
  BacktestOutcome,
  CALIBRATION_STATUS_LABELS,
  CalibrationReport,
  FactorRow,
  ReviewAction,
} from '../../core/models/calibration';

/**
 * S-19 權重校準審核（FR-15）。版面依「畫面功能示意圖 v3.0」S-19：
 * 樣本數警示置頂 → 標記 1 因子預測力＋AI 解讀 → 標記 2 回測驗證 → 審核操作。
 *
 * 分工原則要在畫面上看得出來：數字全部來自統計（regression／backtest），
 * AI 解讀只顯示文字，未產生時直接看統計表（§6.3 Agent 7 降級）。
 * 路由已限 BUYER_LEAD（§9.2），本頁不再另判角色。
 */
@Component({
  selector: 'app-calibration',
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './calibration.component.html',
  styleUrl: './calibration.component.scss',
})
export class CalibrationComponent implements OnInit {
  private service = inject(CalibrationService);
  private weightService = inject(WeightVersionService);
  private dialogService = inject(DialogService);

  readonly factorLabels = FACTOR_LABELS;
  readonly sceneLabels = SCENE_LABELS;
  readonly sceneTypes = SCENE_TYPES;
  readonly factorCodes = FACTOR_CODES;
  readonly statusLabels = CALIBRATION_STATUS_LABELS;
  readonly versionStatusLabels = STATUS_LABELS;
  /** 後端時間一律 UTC；畫面以台北時區顯示，直接切 ISO 字串在 08:00 前會差一天。 */
  readonly TPE = '+0800';

  readonly reports = signal<CalibrationReport[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly generateQuarter = signal(previousQuarter(new Date()));
  readonly partialMode = signal(false);
  readonly accepted = signal<Set<FactorCode>>(new Set());
  readonly comment = signal('');
  readonly showScenes = signal(false);

  readonly versions = signal<WeightVersionSummary[]>([]);
  readonly versionA = signal<number | null>(null);
  readonly versionB = signal<number | null>(null);
  readonly comparison = signal<BacktestComparison | null>(null);
  readonly comparing = signal(false);

  readonly report = computed(() => this.reports().find((r) => r.id === this.selectedId()) ?? null);

  /** 新格式取 factorRows（六因子全列）；dev seed 舊格式只有 factors。 */
  readonly factorRows = computed<FactorRow[]>(() => {
    const regression = this.report()?.regression;
    return regression?.factorRows ?? regression?.factors ?? [];
  });

  /** 新報告為 spearman-tilt；dev seed 舊報告為 pearson，欄名跟著報告走，避免與 S-12（Pearson）數字混淆。 */
  readonly corrLabel = computed(() =>
    this.report()?.regression?.method?.startsWith('spearman') ? 'Spearman' : 'Pearson',
  );

  readonly backtestRows = computed<BacktestOutcome[]>(() => {
    const backtest = this.report()?.backtest;
    return backtest?.schemes ?? backtest?.backtests ?? [];
  });

  /** 有建議調整的因子＝四榜任一榜建議 ≠ 現行（與後端 CalibrationReviewService 同判準）。 */
  readonly changedFactors = computed<Set<FactorCode>>(() => {
    const changed = new Set<FactorCode>();
    for (const scene of this.report()?.regression?.scenes ?? []) {
      for (const w of scene.weights) {
        if (w.currentWeight !== w.suggestedWeight) {
          changed.add(w.code);
        }
      }
    }
    return changed;
  });

  /** 舊格式報告沒有四榜明細，後端無法據以建版本，只能駁回或重新產生。 */
  readonly reviewable = computed(() => !!this.report()?.regression?.scenes && this.report()?.status === 'PENDING');

  readonly attentionNotes = computed(() => this.report()?.attentionNotes ?? []);
  readonly adjustmentAdvice = computed(() => this.report()?.adjustmentAdvice ?? []);

  ngOnInit(): void {
    this.loadReports();
    this.weightService.list(0, 50).subscribe({
      next: (page) => {
        this.versions.set(page.content);
        const current = page.content.find((v) => v.isCurrent);
        this.versionA.set(current?.id ?? page.content[0]?.id ?? null);
        this.versionB.set(page.content.find((v) => v.id !== this.versionA())?.id ?? null);
      },
      error: (err) => this.fail(err),
    });
  }

  /**
   * 主畫面取 GET /calibration/reports/latest（示意圖 S-19 標記 1），
   * 右上角的歷史切換取 GET /calibration/reports?page=。
   */
  loadReports(selectId?: number): void {
    this.loading.set(true);
    forkJoin({ page: this.service.list(0, 8), latest: this.service.latest() }).subscribe({
      next: ({ page, latest }) => {
        const reports = page.content;
        if (latest && !reports.some((r) => r.id === latest.id)) {
          reports.unshift(latest);
        }
        this.reports.set(reports);
        this.select(selectId ?? latest?.id ?? null);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.fail(err);
      },
    });
  }

  select(id: number | null): void {
    this.selectedId.set(id);
    this.partialMode.set(false);
    this.accepted.set(new Set());
    this.comment.set('');
  }

  generate(): void {
    const quarter = this.generateQuarter().trim().toUpperCase();
    this.acting.set(true);
    this.service.generate(quarter).subscribe({
      next: (report) => {
        this.acting.set(false);
        this.flash(`已產生 ${report.quarter} 校準報告（樣本 ${report.sampleSize} 筆）`);
        this.loadReports(report.id);
      },
      error: (err) => {
        this.acting.set(false);
        this.fail(err);
      },
    });
  }

  toggleAccepted(code: FactorCode, checked: boolean): void {
    const next = new Set(this.accepted());
    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }
    this.accepted.set(next);
  }

  startPartial(): void {
    this.partialMode.set(true);
    this.accepted.set(new Set(this.changedFactors()));
  }

  submit(action: ReviewAction): void {
    const r = this.report();
    if (!r) {
      return;
    }
    const acceptedList = [...this.accepted()];
    const messages: Record<ReviewAction, string> = {
      APPROVE: `核准 ${r.quarter} 全部建議調整，並建立權重版本草稿？草稿需再到 S-09 核准並指定生效日才會生效。`,
      PARTIAL: `只採納「${acceptedList.map((c) => this.factorLabels[c]).join('、')}」的調整，其餘因子等比例縮放，並建立權重版本草稿？`,
      REJECT: `駁回 ${r.quarter} 校準建議？權重不會有任何變動。`,
    };
    this.dialogService
      .Confirm({
        title: '校準審核',
        message: messages[action],
        confirmText: action === 'REJECT' ? '駁回' : '確認',
        isDanger: action === 'REJECT',
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.acting.set(true);
        this.service
          .review(r.id, {
            action,
            acceptedFactors: action === 'PARTIAL' ? acceptedList : null,
            comment: this.comment().trim() || null,
          })
          .subscribe({
            next: (updated) => {
              this.acting.set(false);
              this.reports.set(this.reports().map((x) => (x.id === updated.id ? updated : x)));
              this.select(updated.id);
              this.flash(
                updated.weightVersionNo
                  ? `已建立權重版本草稿 ${updated.weightVersionNo}，請至 S-09 核准並指定生效日`
                  : `已${this.statusLabels[updated.status]}`,
              );
            },
            error: (err) => {
              this.acting.set(false);
              this.fail(err);
            },
          });
      });
  }

  compare(): void {
    const a = this.versionA();
    const b = this.versionB();
    if (a === null || b === null) {
      return;
    }
    this.comparing.set(true);
    this.service.backtest(a, b).subscribe({
      next: (result) => {
        this.comparison.set(result);
        this.comparing.set(false);
      },
      error: (err) => {
        this.comparing.set(false);
        this.fail(err);
      },
    });
  }

  sceneWeights(scene: SceneType) {
    return this.report()?.regression?.scenes?.find((s) => s.sceneType === scene)?.weights ?? [];
  }

  /** 差異以百分點顯示：+7、−5、持平。 */
  diff(row: { currentWeight: number; suggestedWeight: number }): string {
    const points = Math.round((row.suggestedWeight - row.currentWeight) * 1000) / 10;
    if (points === 0) {
      return '持平';
    }
    return points > 0 ? `＋${points}` : `−${Math.abs(points)}`;
  }

  diffClass(row: { currentWeight: number; suggestedWeight: number }): string {
    const d = row.suggestedWeight - row.currentWeight;
    return d > 0 ? 'up' : d < 0 ? 'down' : '';
  }

  pct(value: number | null | undefined, digits = 0): string {
    return value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;
  }

  weightPct(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${Math.round(value * 1000) / 10}%`;
  }

  num(value: number | null | undefined, digits = 2): string {
    return value === null || value === undefined ? '—' : value.toFixed(digits);
  }

  /** 相關強度長條寬度：|r| 0–1 → 0–100%。 */
  barWidth(value: number | null | undefined): number {
    return value === null || value === undefined ? 0 : Math.min(100, Math.abs(value) * 100);
  }

  factorName(code: string): string {
    return this.factorLabels[code as FactorCode] ?? code;
  }

  schemeLabel(row: BacktestOutcome): string {
    return row.label ?? row.scheme ?? row.code ?? '—';
  }

  private flash(message: string): void {
    this.errorMessage.set(null);
    this.successMessage.set(message);
    setTimeout(() => {
      if (this.successMessage() === message) {
        this.successMessage.set(null);
      }
    }, 5000);
  }

  private fail(err: unknown): void {
    const apiError = err instanceof HttpErrorResponse ? err.error?.error : null;
    this.successMessage.set(null);
    this.errorMessage.set(apiError?.message ?? '操作失敗，請稍後再試');
  }
}

function previousQuarter(today: Date): string {
  const q = Math.floor(today.getMonth() / 3) + 1;
  return q === 1 ? `${today.getFullYear() - 1}Q4` : `${today.getFullYear()}Q${q - 1}`;
}
