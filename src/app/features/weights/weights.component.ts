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
 * 示意圖中的「AI 選組規則」「風險扣分規則」「每組品項數」「本季判定統計」
 * 後端尚無對應端點，故不呈現，於頁尾標示尚未實作而非填假資料。
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
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly mode = signal<Mode>('view');

  /** 核准用的生效日，預設今天。 */
  readonly effectiveFrom = signal(new Date().toISOString().slice(0, 10));

  /** 建立／編輯表單。權重以字串保存，避免輸入過程被 number 轉型吃掉小數點。 */
  readonly form = signal<FormState>(blankForm());

  readonly current = computed(() => this.versions().find((v) => v.isCurrent) ?? null);

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

  /** 表單四榜的即時加總，讓使用者存檔前就看得到是不是 1.000。 */
  readonly formSums = computed(() => {
    const f = this.form();
    const sums = {} as Record<SceneType, number>;
    for (const scene of SCENE_TYPES) {
      sums[scene] = FACTOR_CODES.reduce((acc, code) => acc + toNumber(f.weights[scene][code]), 0);
    }
    return sums;
  });

  readonly canSubmit = computed(() => {
    const sums = this.formSums();
    return SCENE_TYPES.every((s) => Math.abs(sums[s] - 1) < 1e-9);
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
      form.weights[group.sceneType][code] = String(group.weights[code] ?? 0);
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
      weights[code] = toNumber(form.weights[scene][code]);
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
