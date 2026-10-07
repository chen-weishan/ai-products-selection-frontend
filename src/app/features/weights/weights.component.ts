import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { WeightVersionService } from './weight-version.service';
import {
  CreateWeightVersionRequest,
  FACTOR_CODES,
  FACTOR_LABELS,
  FactorCode,
  SCENE_LABELS,
  SCENE_SHORT_LABELS,
  SCENE_TYPES,
  SceneGroupRequest,
  SceneStat,
  SceneStats,
  SceneType,
  STATUS_LABELS,
  WeightVersionDetail,
  WeightVersionStatus,
  WeightVersionSummary,
} from '../../core/models/weight';

type Mode = 'view' | 'create' | 'edit';

/**
 * S-09 情境權重組（FR-08）。版面依「畫面功能示意圖 v3.0」。
 *
 * 「AI 選組規則」卡與「每組品項數」取自 GET /weight-versions/{id}/scene-stats（§8.2，v3.0 補入）。
 * 「風險扣分規則」後端尚無對應端點，故不呈現，於頁尾標示尚未實作而非填假資料。
 */
@Component({
  selector: 'app-weights',
  imports: [],
  templateUrl: './weights.component.html',
  styleUrl: './weights.component.scss',
})
export class WeightsComponent implements OnInit {
  private service = inject(WeightVersionService);

  readonly sceneTypes = SCENE_TYPES;
  readonly factorCodes = FACTOR_CODES;
  readonly sceneLabels = SCENE_LABELS;
  readonly sceneShortLabels = SCENE_SHORT_LABELS;
  readonly factorLabels = FACTOR_LABELS;
  readonly statusLabels = STATUS_LABELS;

  readonly versions = signal<WeightVersionSummary[]>([]);
  readonly selected = signal<WeightVersionDetail | null>(null);
  /** 選定版本的情境判定統計。載入失敗時為 null，不影響權重矩陣。 */
  readonly sceneStats = signal<SceneStats | null>(null);
  readonly sceneStatsError = signal(false);
  /** 最後一次請求統計的版本 id，用來丟棄晚到的舊回應。 */
  private statsRequestedId: number | null = null;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly mode = signal<Mode>('view');

  /** 核准用的生效日，預設今天。 */
  readonly effectiveFrom = signal(new Date().toISOString().slice(0, 10));

  /**
   * 建立／編輯表單。權重以 0–100 的百分比字串保存（避免輸入過程被 number 轉型吃掉小數點），
   * 送出時才換回後端要的 0.000–1.000（toRequest）。
   */
  readonly form = signal<FormState>(blankForm());

  readonly current = computed(() => this.versions().find((v) => v.isCurrent) ?? null);

  /** 依情境查統計列，給權重矩陣的「每組品項數」用。 */
  readonly statsByScene = computed(() => {
    const byScene = {} as Partial<Record<SceneType, SceneStat>>;
    for (const s of this.sceneStats()?.scenes ?? []) byScene[s.sceneType] = s;
    return byScene;
  });

  /**
   * 每一榜的最高權重值，用於在矩陣上加深標示（示意圖的 .cell.hi）。
   * 存值而非因子代碼：同一榜可能有兩個因子並列最高（常態補貨型的毛利率與轉換率
   * 都是 0.30），並列時應該一起標示。
   */
  readonly peakValues = computed(() => {
    const detail = this.selected();
    const peaks = {} as Record<SceneType, number>;
    if (!detail) return peaks;
    for (const group of detail.sceneGroups) {
      peaks[group.sceneType] = Math.max(...FACTOR_CODES.map((c) => group.weights[c] ?? 0));
    }
    return peaks;
  });

  /**
   * 表單四榜的即時加總（百分比），讓使用者存檔前就看得到是不是 100。
   * 以「十分之一」為單位的整數相加再除回來，避開 0.1 + 0.2 這類浮點誤差。
   */
  readonly formSums = computed(() => {
    const f = this.form();
    const sums = {} as Record<SceneType, number>;
    for (const scene of SCENE_TYPES) {
      const tenths = FACTOR_CODES.reduce((acc, code) => acc + toTenths(f.weights[scene][code]), 0);
      sums[scene] = tenths / 10;
    }
    return sums;
  });

  readonly canSubmit = computed(() => {
    const f = this.form();
    const sums = this.formSums();
    return SCENE_TYPES.every(
      (s) => sums[s] === 100 && FACTOR_CODES.every((c) => isValidPercent(f.weights[s][c])),
    );
  });

  ngOnInit(): void {
    this.reload();
  }

  // ── 讀取 ────────────────────────────────────────────────────

  reload(selectId?: number): void {
    this.loading.set(true);
    this.service.list(0, 50).subscribe({
      next: (page) => {
        this.versions.set(page.content);
        this.loading.set(false);
        const target = selectId ?? page.content.find((v) => v.isCurrent)?.id ?? page.content[0]?.id;
        if (target != null) {
          this.select(target);
        } else {
          this.selected.set(null);
        }
      },
      error: (err) => this.fail(err),
    });
  }

  select(id: number): void {
    this.clearMessages();
    this.service.getDetail(id).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.mode.set('view');
      },
      error: (err) => this.fail(err),
    });
    this.loadSceneStats(id);
  }

  /** 統計是附屬資訊：失敗只在卡片上標示，不走 fail() 蓋掉整頁的錯誤訊息。 */
  private loadSceneStats(id: number): void {
    this.statsRequestedId = id;
    this.sceneStats.set(null);
    this.sceneStatsError.set(false);
    this.service.getSceneStats(id).subscribe({
      // 快速切換版本時，晚到的舊回應不可蓋掉新版本的統計
      next: (stats) => {
        if (stats.weightVersionId === this.statsRequestedId) this.sceneStats.set(stats);
      },
      error: () => {
        if (id === this.statsRequestedId) this.sceneStatsError.set(true);
      },
    });
  }

  onSelectChange(value: string): void {
    const id = Number(value);
    if (Number.isFinite(id)) this.select(id);
  }

  // ── 建立 / 編輯 ─────────────────────────────────────────────

  startCreate(): void {
    this.clearMessages();
    this.form.set(blankForm());
    this.mode.set('create');
  }

  startEdit(): void {
    const detail = this.selected();
    if (!detail) return;
    this.clearMessages();
    this.form.set(formFromDetail(detail));
    this.mode.set('edit');
  }

  cancel(): void {
    this.clearMessages();
    this.mode.set('view');
  }

  setField(field: 'versionNo' | 'name' | 'changeNote', value: string): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  /** 單格是否合法：0–100、最多一位小數。樣板用來把不合法的格子標紅。 */
  validWeight(value: string): boolean {
    return isValidPercent(value);
  }

  setWeight(scene: SceneType, factor: FactorCode, value: string): void {
    this.form.update((f) => ({
      ...f,
      weights: { ...f.weights, [scene]: { ...f.weights[scene], [factor]: value } },
    }));
  }

  setThreshold(scene: SceneType, field: 'gradeAMin' | 'gradeBMin', value: string): void {
    this.form.update((f) => ({
      ...f,
      thresholds: { ...f.thresholds, [scene]: { ...f.thresholds[scene], [field]: value } },
    }));
  }

  submit(): void {
    this.clearMessages();
    const body = toRequest(this.form());
    const editing = this.mode() === 'edit' ? this.selected() : null;
    const call = editing ? this.service.update(editing.id, body) : this.service.create(body);

    this.loading.set(true);
    call.subscribe({
      next: (detail) => {
        this.loading.set(false);
        this.successMessage.set(editing ? '已儲存草稿。' : `已建立草稿 ${detail.versionNo}。`);
        this.reload(detail.id);
      },
      error: (err) => this.fail(err),
    });
  }

  // ── 核准 ────────────────────────────────────────────────────

  approve(): void {
    const detail = this.selected();
    if (!detail) return;
    this.clearMessages();
    this.loading.set(true);
    this.service.approve(detail.id, { effectiveFrom: this.effectiveFrom() }).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.successMessage.set(`${result.versionNo} 已核准生效，原生效版本已退為停用。`);
        this.reload(result.id);
      },
      error: (err) => this.fail(err),
    });
  }

  setEffectiveFrom(value: string): void {
    this.effectiveFrom.set(value);
  }

  // ── 顯示格式 ────────────────────────────────────────────────

  /** 0.075 → "7.5%"。用四捨五入避開浮點誤差（0.08 * 100 = 8.000000000000002）。 */
  percent(value: number | null | undefined): string {
    if (value == null) return '—';
    const n = Math.round(value * 1000) / 10;
    return `${n}%`;
  }

  /** 版本歷程的狀態標籤配色：生效中綠、草稿琥珀、其餘灰。 */
  statusTagClass(v: { status: WeightVersionStatus; isCurrent: boolean }): string {
    if (v.isCurrent) return 'tag green';
    if (v.status === 'DRAFT') return 'tag amber';
    return 'tag';
  }

  statusText(v: { status: WeightVersionStatus; isCurrent: boolean }): string {
    if (v.isCurrent) return '生效中';
    if (v.status === 'DRAFT') return '待審核';
    return this.statusLabels[v.status];
  }

  // ── 共用 ────────────────────────────────────────────────────

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  /** 後端統一錯誤封套（§8.1）：優先顯示 error.message，其次列出欄位錯誤。 */
  private fail(err: unknown): void {
    this.loading.set(false);
    if (err instanceof HttpErrorResponse) {
      const apiError = err.error?.error;
      if (apiError) {
        const fields = (apiError.fieldErrors ?? [])
          .map((f: { field: string; message: string }) => `${f.field}：${f.message}`)
          .join('；');
        this.errorMessage.set(
          `${apiError.code}　${apiError.message}${fields ? '（' + fields + '）' : ''}`,
        );
        return;
      }
      if (err.status === 0) {
        this.errorMessage.set('連不到後端，請確認 bootRun 有在跑（localhost:8080）。');
        return;
      }
      this.errorMessage.set(`HTTP ${err.status}　${err.statusText}`);
      return;
    }
    this.errorMessage.set('發生未預期的錯誤。');
  }
}

// ── 表單狀態 ──────────────────────────────────────────────────

interface FormState {
  versionNo: string;
  name: string;
  changeNote: string;
  /** 0–100 的百分比字串，不是後端的 0.000–1.000。 */
  weights: Record<SceneType, Record<FactorCode, string>>;
  thresholds: Record<SceneType, { gradeAMin: string; gradeBMin: string }>;
}

function blankForm(): FormState {
  const weights = {} as Record<SceneType, Record<FactorCode, string>>;
  const thresholds = {} as Record<SceneType, { gradeAMin: string; gradeBMin: string }>;
  for (const scene of SCENE_TYPES) {
    weights[scene] = {} as Record<FactorCode, string>;
    for (const code of FACTOR_CODES) {
      weights[scene][code] = '0';
    }
    thresholds[scene] = { gradeAMin: '85', gradeBMin: '70' };
  }
  return { versionNo: '', name: '', changeNote: '', weights, thresholds };
}

function formFromDetail(detail: WeightVersionDetail): FormState {
  const form = blankForm();
  form.versionNo = detail.versionNo;
  form.name = detail.name;
  form.changeNote = detail.changeNote ?? '';
  for (const group of detail.sceneGroups) {
    for (const code of FACTOR_CODES) {
      // 0.075 → "7.5"。先乘 1000 取整再除 10，避開 0.075 * 100 = 7.499999999999999
      form.weights[group.sceneType][code] = String(Math.round((group.weights[code] ?? 0) * 1000) / 10);
    }
    form.thresholds[group.sceneType] = {
      gradeAMin: String(group.gradeAMin),
      gradeBMin: String(group.gradeBMin),
    };
  }
  return form;
}

function toRequest(form: FormState): CreateWeightVersionRequest {
  const sceneGroups: SceneGroupRequest[] = SCENE_TYPES.map((scene) => {
    const weights = {} as Record<FactorCode, number>;
    for (const code of FACTOR_CODES) {
      // 百分比換回後端的小數：7.5 → 75 / 1000 = 0.075（weight_profile.weight 為 NUMERIC(4,3)）
      weights[code] = toTenths(form.weights[scene][code]) / 1000;
    }
    return {
      sceneType: scene,
      weights,
      gradeAMin: toNumber(form.thresholds[scene].gradeAMin),
      gradeBMin: toNumber(form.thresholds[scene].gradeBMin),
    };
  });

  return {
    versionNo: form.versionNo.trim(),
    name: form.name.trim(),
    changeNote: form.changeNote.trim() || null,
    sceneGroups,
  };
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 百分比字串 → 以十分之一為單位的整數（7.5 → 75）。 */
function toTenths(value: string): number {
  return Math.round(toNumber(value) * 10);
}

/**
 * 0–100、最多一位小數。限制一位小數是因為後端 weight_profile.weight 為 NUMERIC(4,3)：
 * 7.55% = 0.0755 寫入時會被資料庫進位成 0.076，加總在送出時是 1 但存進去就不是，
 * 之後核准會被「加總必須等於 1.000」擋下。空字串視為不合法，避免被當成 0 默默送出。
 */
function isValidPercent(value: string): boolean {
  if (value.trim() === '') return false;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return false;
  return Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
}
