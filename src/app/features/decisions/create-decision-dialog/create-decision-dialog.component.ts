import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DecisionService } from '../decision.service';
import {
  DECISION_BADGE_CLASS,
  DECISION_LABELS,
  Decision,
  DecisionContext,
  DecisionType,
  ProductOption,
  ProductStatus,
} from '../../../core/models/decision';
import { SCENE_LABELS } from '../../../core/models/weight';

/** 開啟時帶 productId 就直接進入表單（品項詳情頁用）；不帶則先挑品項（S-12 用）。 */
export interface CreateDecisionDialogData {
  productId?: number;
}

/**
 * 建立採購決策（§FR-11-1）。
 *
 * 可選哪些決策、會綁哪筆評分、AI 建議什麼，全部由後端 decision-context 判定，
 * 這裡不重寫 §7.4 狀態機：前端的判斷只是提示，真正的關卡在後端。
 */
@Component({
  selector: 'app-create-decision-dialog',
  imports: [FormsModule, MatDialogModule],
  templateUrl: './create-decision-dialog.component.html',
  styleUrl: './create-decision-dialog.component.scss',
})
export class CreateDecisionDialogComponent implements OnInit {
  private service = inject(DecisionService);
  private dialogRef = inject(MatDialogRef<CreateDecisionDialogComponent, Decision | undefined>);
  readonly data: CreateDecisionDialogData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly decisionLabels = DECISION_LABELS;
  readonly decisionBadge = DECISION_BADGE_CLASS;
  readonly sceneLabels = SCENE_LABELS;
  readonly decisionTypes: DecisionType[] = ['ADOPT', 'WATCH', 'REJECT'];

  // ---- 挑品項 ----
  readonly keyword = signal('');
  readonly statusFilter = signal<ProductStatus>('EVALUATING');
  readonly options = signal<ProductOption[]>([]);
  readonly searching = signal(false);

  // ---- 表單 ----
  readonly context = signal<DecisionContext | null>(null);
  readonly loadingContext = signal(false);
  readonly decision = signal<DecisionType | null>(null);
  readonly firstOrderQty = signal<number | null>(null);
  readonly expectedListDate = signal<string>('');
  readonly reason = signal('');

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  /** AC-11-2：與 AI 建議不同（含沒有 AI 建議）時理由必填。 */
  readonly reasonRequired = computed(() => {
    const ai = this.context()?.ai;
    return this.decision() !== null && (!ai || ai.action !== this.decision());
  });

  readonly isAdopt = computed(() => this.decision() === 'ADOPT');

  readonly canSubmit = computed(() => {
    if (!this.context() || !this.decision() || this.submitting()) {
      return false;
    }
    if (this.isAdopt() && !(this.firstOrderQty() && this.firstOrderQty()! > 0)) {
      return false;
    }
    return !(this.reasonRequired() && !this.reason().trim());
  });

  ngOnInit(): void {
    if (this.data.productId) {
      this.loadContext(this.data.productId);
    } else {
      this.search();
    }
  }

  search(): void {
    this.searching.set(true);
    this.service.searchProducts(this.keyword().trim(), this.statusFilter()).subscribe({
      next: (list) => {
        this.options.set(list);
        this.searching.set(false);
      },
      error: (err) => {
        this.searching.set(false);
        this.fail(err);
      },
    });
  }

  setStatusFilter(status: ProductStatus): void {
    this.statusFilter.set(status);
    this.search();
  }

  pick(product: ProductOption): void {
    this.loadContext(product.id);
  }

  /** 回到挑品項（只在 S-12 開啟時可用）。 */
  backToPicker(): void {
    this.context.set(null);
    this.decision.set(null);
    this.errorMessage.set(null);
    this.fieldErrors.set({});
  }

  loadContext(productId: number): void {
    this.loadingContext.set(true);
    this.errorMessage.set(null);
    this.service.context(productId).subscribe({
      next: (ctx) => {
        this.context.set(ctx);
        this.loadingContext.set(false);
        // 預設選 AI 建議的動作（若目前允許），並帶入建議數量的中位數
        const ai = ctx.ai;
        const preset = ai && ctx.allowedDecisions.includes(ai.action) ? ai.action : null;
        this.chooseDecision(preset);
      },
      error: (err) => {
        this.loadingContext.set(false);
        this.fail(err);
      },
    });
  }

  chooseDecision(type: DecisionType | null): void {
    this.decision.set(type);
    this.fieldErrors.set({});
    const ai = this.context()?.ai;
    if (type === 'ADOPT' && this.firstOrderQty() === null && ai?.qtyMin && ai?.qtyMax) {
      this.firstOrderQty.set(Math.round((ai.qtyMin + ai.qtyMax) / 2));
    }
  }

  isAllowed(type: DecisionType): boolean {
    return this.context()?.allowedDecisions.includes(type) ?? false;
  }

  submit(): void {
    const ctx = this.context();
    const decision = this.decision();
    if (!ctx || !decision || !this.canSubmit()) {
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.fieldErrors.set({});
    this.service
      .create(ctx.productId, {
        decision,
        firstOrderQty: this.isAdopt() ? this.firstOrderQty() : null,
        expectedListDate: this.isAdopt() && this.expectedListDate() ? this.expectedListDate() : null,
        reason: this.reason().trim() || null,
      })
      .subscribe({
        next: (created) => this.dialogRef.close(created),
        error: (err) => {
          this.submitting.set(false);
          this.fail(err);
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  private fail(err: unknown): void {
    const body = err instanceof HttpErrorResponse ? err.error : null;
    const apiError = body?.error;
    this.errorMessage.set(apiError?.message ?? '操作失敗，請稍後再試');
    const fields: Record<string, string> = {};
    for (const fe of apiError?.fieldErrors ?? []) {
      fields[fe.field] = fe.message;
    }
    this.fieldErrors.set(fields);
  }
}
