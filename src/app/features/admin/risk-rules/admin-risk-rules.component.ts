import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, forkJoin, of, switchMap } from 'rxjs';
import { RISK_TYPE_META, RecalculationStatus, RiskRuleItem } from '../../risks/risk.model';
import { RiskService } from '../../risks/risk.service';
import { CategoryNode, MasterDataService } from '../master-data.service';
import {
  LOCKED_RULES,
  LOGISTICS_CONDITION_LABELS,
  PENALTY_SPECS,
  PenaltySpec,
  RuleFieldSpec,
  fieldError,
  fieldsFor,
  toDisplay,
  toStored,
} from '../risk-rule-fields';

/** 扣分類規則排前面，示警類在後；同一類別內全域規則先於品類覆寫。 */
const RULE_ORDER = [
  'REVIEW_RISK', 'LOGISTICS_RISK', 'INVENTORY_RISK', 'PENALTY_CAP',
  'HEAT_CRASH', 'HEAT_SURGE', 'SEASON_MISMATCH', 'FESTIVAL_WINDOW_CLOSING', 'LOW_CONFIDENCE',
];
const PENALTY_RULES = ['REVIEW_RISK', 'LOGISTICS_RISK', 'INVENTORY_RISK', 'PENALTY_CAP'];

export interface RuleDraft {
  rule: RiskRuleItem;
  key: string;
  fields: RuleFieldSpec[];
  values: Record<string, number | null>;
  penalty: PenaltySpec | null;
  maxPenalty: number | null;
  locked: string | null;
  conditions: string[];
}

@Component({
  selector: 'app-admin-risk-rules',
  imports: [NgTemplateOutlet, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './admin-risk-rules.component.html',
  styleUrls: ['../admin-shared.scss', './admin-risk-rules.component.scss'],
})
export class AdminRiskRulesComponent {
  private readonly risks = inject(RiskService);
  private readonly masterData = inject(MasterDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly savingKey = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly recalculation = signal<RecalculationStatus | null>(null);
  readonly penaltyDrafts = signal<RuleDraft[]>([]);
  readonly alertDrafts = signal<RuleDraft[]>([]);
  private categoryNames = new Map<number, string>();

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      rules: this.risks.getRiskRules(),
      // 品類名稱只用來顯示「適用範圍」，取不到就退回顯示編號
      categories: this.masterData.categories().pipe(catchError(() => of([] as CategoryNode[]))),
    })
      .pipe(finalize(() => this.loading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ rules, categories }) => {
          this.categoryNames = flattenNames(categories);
          this.apply(rules.rules, rules.recalculation);
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }

  label(code: string): string {
    return RISK_TYPE_META[code]?.label ?? code;
  }

  description(rule: RiskRuleItem): string {
    return rule.description || RISK_TYPE_META[rule.ruleCode]?.description || '';
  }

  scope(rule: RiskRuleItem): string {
    if (rule.categoryId == null) return '全部品類';
    return `僅「${this.categoryNames.get(rule.categoryId) ?? '品類 #' + rule.categoryId}」`;
  }

  conditionLabel(code: string): string {
    return LOGISTICS_CONDITION_LABELS[code] ?? code;
  }

  errorOf(draft: RuleDraft, field: RuleFieldSpec): string | null {
    return fieldError(field, draft.values[field.key]);
  }

  penaltyError(draft: RuleDraft): string | null {
    if (draft.penalty == null) return null;
    const value = draft.maxPenalty;
    if (value == null || Number.isNaN(value)) return '請填寫扣分上限';
    return value < 0 || value > draft.penalty.max ? `扣分上限須介於 0～${draft.penalty.max}` : null;
  }

  hasErrors(draft: RuleDraft): boolean {
    return draft.fields.some((field) => this.errorOf(draft, field) != null) || this.penaltyError(draft) != null;
  }

  isDirty(draft: RuleDraft): boolean {
    const changedField = draft.fields.some((field) =>
      draft.values[field.key] !== toDisplay(field, draft.rule.thresholdJson[field.key]));
    const changedPenalty = draft.penalty != null && draft.maxPenalty !== (draft.rule.maxPenalty ?? null);
    return changedField || changedPenalty;
  }

  reset(draft: RuleDraft): void {
    const fresh = toDraft(draft.rule);
    draft.values = fresh.values;
    draft.maxPenalty = fresh.maxPenalty;
  }

  save(draft: RuleDraft): void {
    if (this.savingKey() != null || draft.locked || this.hasErrors(draft) || !this.isDirty(draft)) return;
    // 保留原 JSON 裡畫面不編輯的欄位（例如物流條件清單），只覆蓋數值欄位
    const threshold: Record<string, unknown> = { ...draft.rule.thresholdJson };
    for (const field of draft.fields) {
      threshold[field.key] = toStored(field, draft.values[field.key] as number);
    }
    this.savingKey.set(draft.key);
    this.error.set(null);
    this.success.set(null);
    this.risks.updateRuleThreshold(
      draft.rule.ruleCode,
      threshold,
      draft.rule.categoryId ?? null,
      draft.penalty ? draft.maxPenalty ?? undefined : undefined,
    ).pipe(
      switchMap(() => this.risks.getRiskRules()),
      finalize(() => this.savingKey.set(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (rules) => {
        this.apply(rules.rules, rules.recalculation);
        this.success.set(`「${this.label(draft.rule.ruleCode)}」已儲存，已在背景重新計算全部品項的扣分與示警。`);
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }

  private apply(rules: RiskRuleItem[], recalculation: RecalculationStatus): void {
    const drafts = [...rules]
      .sort((a, b) => order(a.ruleCode) - order(b.ruleCode) || (a.categoryId ?? -1) - (b.categoryId ?? -1))
      .map(toDraft);
    this.penaltyDrafts.set(drafts.filter((draft) => PENALTY_RULES.includes(draft.rule.ruleCode)));
    this.alertDrafts.set(drafts.filter((draft) => !PENALTY_RULES.includes(draft.rule.ruleCode)));
    this.recalculation.set(recalculation);
  }
}

function toDraft(rule: RiskRuleItem): RuleDraft {
  const fields = LOCKED_RULES[rule.ruleCode] ? [] : fieldsFor(rule.ruleCode, rule.thresholdJson);
  const conditions = Array.isArray(rule.thresholdJson['conditions'])
    ? (rule.thresholdJson['conditions'] as unknown[]).map(String)
    : [];
  return {
    rule,
    key: `${rule.ruleCode}-${rule.categoryId ?? 'global'}`,
    fields,
    values: Object.fromEntries(fields.map((field) => [field.key, toDisplay(field, rule.thresholdJson[field.key])])),
    penalty: PENALTY_SPECS[rule.ruleCode] ?? null,
    maxPenalty: rule.maxPenalty ?? null,
    locked: LOCKED_RULES[rule.ruleCode] ?? null,
    conditions,
  };
}

function order(code: string): number {
  const index = RULE_ORDER.indexOf(code);
  return index < 0 ? RULE_ORDER.length : index;
}

function flattenNames(nodes: CategoryNode[], names = new Map<number, string>()): Map<number, string> {
  for (const node of nodes) {
    names.set(node.id, node.name);
    flattenNames(node.children ?? [], names);
  }
  return names;
}
