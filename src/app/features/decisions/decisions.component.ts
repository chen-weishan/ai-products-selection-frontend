import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { DecisionService } from './decision.service';
import { DialogService } from '../../services/dialog-service';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/auth-model';
import { FACTOR_LABELS, SCENE_LABELS } from '../../core/models/weight';
import { PENALTY_FACTOR_LABELS } from '../../core/models/score';
import {
  DECISION_BADGE_CLASS,
  DECISION_LABELS,
  Decision,
  DecisionAccuracy,
  DecisionSnapshot,
  DecisionStage,
  DecisionType,
  HEAT_SOURCE_LABELS,
  POST_NOTE_LABELS,
  PostNoteCode,
  SELLOUT_LABELS,
  SOURCE_AVAILABILITY_LABELS,
  STAGE_BADGE_CLASS,
  STAGE_LABELS,
  SelloutStatus,
} from '../../core/models/decision';
import {
  CreateDecisionDialogComponent,
  CreateDecisionDialogData,
} from './create-decision-dialog/create-decision-dialog.component';

/** §2.1 權限矩陣中本頁用到的列。前端只控制顯示，真正的關卡是後端 @PreAuthorize。 */
const ROLES_CREATE: UserRole[] = ['BUYER', 'BUYER_LEAD', 'SYS_ADMIN']; // 列 11
const ROLES_CLOSE_FILL: UserRole[] = ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN']; // 列 12
const ROLES_REVIEW: UserRole[] = ['BUYER_LEAD', 'SYS_ADMIN']; // 列 13
const ROLES_LAUNCH: UserRole[] = ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN']; // 列 4（標記上架）

type DecisionFilter = 'ALL' | DecisionType;
type AccuracyRange = 'ALL' | '4W' | '12W';

/**
 * S-12 決策與回饋閉環（FR-11）。版面依「畫面功能示意圖 v3.0」S-12：
 * 標記 1 決策快照、2 結案回填、3 預測準確度；進度條為 建立決策 → 開團 → 結案 → 回填。
 *
 * 左側為決策清單（示意圖只畫單筆，清單是為了能切換不同決策而補的）。
 */
@Component({
  selector: 'app-decisions',
  imports: [FormsModule],
  templateUrl: './decisions.component.html',
  styleUrl: './decisions.component.scss',
})
export class DecisionsComponent implements OnInit {
  private service = inject(DecisionService);
  private dialog = inject(MatDialog);
  private dialogService = inject(DialogService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly decisionLabels = DECISION_LABELS;
  readonly stageLabels = STAGE_LABELS;
  readonly selloutLabels = SELLOUT_LABELS;
  readonly postNoteLabels = POST_NOTE_LABELS;
  readonly sceneLabels = SCENE_LABELS;
  readonly factorLabels = FACTOR_LABELS;
  readonly penaltyLabels = PENALTY_FACTOR_LABELS;
  readonly sourceLabels = HEAT_SOURCE_LABELS;
  readonly availabilityLabels = SOURCE_AVAILABILITY_LABELS;
  readonly selloutCodes = Object.keys(SELLOUT_LABELS) as SelloutStatus[];
  readonly postNoteCodes = Object.keys(POST_NOTE_LABELS) as PostNoteCode[];

  // ---- 清單 ----
  readonly decisions = signal<Decision[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly pageSize = 20;
  readonly decisionFilter = signal<DecisionFilter>('ALL');
  readonly pendingOnly = signal(false);
  readonly listLoading = signal(false);

  // ---- 詳情 ----
  readonly selectedId = signal<number | null>(null);
  readonly selected = signal<Decision | null>(null);
  readonly snapshot = signal<DecisionSnapshot | null>(null);
  readonly detailLoading = signal(false);
  readonly acting = signal(false);

  // 結案表單
  readonly closeDate = signal(todayIso());
  // 回填表單（比率欄位以百分比輸入，送出時換回 0–1）
  readonly actualQty = signal<number | null>(null);
  readonly selloutStatus = signal<SelloutStatus | null>(null);
  readonly returnRatePct = signal<number | null>(null);
  readonly marginPct = signal<number | null>(null);
  readonly postNoteCode = signal<PostNoteCode | null>(null);
  readonly postNoteText = signal('');
  readonly resultFormOpen = signal(true);

  // ---- 準確度 ----
  readonly accuracy = signal<DecisionAccuracy | null>(null);
  readonly accRange = signal<AccuracyRange>('ALL');
  readonly accCategoryId = signal<number | null>(null);
  readonly accDecidedBy = signal<number | null>(null);
  readonly categories = signal<{ id: number; name: string }[]>([]);
  readonly deciders = signal<{ id: number; name: string }[]>([]);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly canCreate = computed(() => this.hasRole(ROLES_CREATE));
  readonly canCloseFill = computed(() => this.hasRole(ROLES_CLOSE_FILL));
  readonly canReview = computed(() => this.hasRole(ROLES_REVIEW));
  readonly canLaunch = computed(() => this.hasRole(ROLES_LAUNCH));

  readonly canSubmitResult = computed(
    () =>
      !this.acting() &&
      this.actualQty() !== null &&
      this.actualQty()! >= 0 &&
      this.selloutStatus() !== null &&
      this.marginPct() !== null,
  );

  /** 進度條：建立決策 → 開團 → 結案 → 回填。WATCH／REJECT 只有第一步。 */
  readonly steps = computed(() => {
    const stage = this.selected()?.stage;
    const order: DecisionStage[] = ['AWAITING_LAUNCH', 'IN_CAMPAIGN', 'PENDING_RESULT', 'COMPLETED'];
    const reached = stage ? order.indexOf(stage) : -1;
    return [
      { label: '建立決策', done: true },
      { label: '開團', done: reached >= 1 },
      { label: '結案', done: reached >= 2 },
      { label: '回填結果', done: reached >= 3 },
    ];
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('id'));
    this.loadList(Number.isInteger(id) && id > 0 ? id : null);
    this.loadAccuracy();
    this.service.categories().subscribe({ next: (list) => this.categories.set(list), error: () => {} });
    this.loadDeciders();
  }

  // ================= 清單 =================

  loadList(selectId: number | null = this.selectedId()): void {
    this.listLoading.set(true);
    const filter = this.decisionFilter();
    this.service
      .list({
        decision: filter === 'ALL' ? null : filter,
        pendingResult: this.pendingOnly() || null,
        page: this.page(),
        size: this.pageSize,
      })
      .subscribe({
        next: (page) => {
          this.decisions.set(page.content);
          this.total.set(page.totalElements);
          this.listLoading.set(false);
          const target = selectId ?? page.content[0]?.id ?? null;
          if (target !== null) {
            this.select(target);
          } else {
            this.clearSelection();
          }
        },
        error: (err) => {
          this.listLoading.set(false);
          this.fail(err);
        },
      });
  }

  setDecisionFilter(filter: DecisionFilter): void {
    this.decisionFilter.set(filter);
    this.page.set(0);
    this.loadList(null);
  }

  togglePending(): void {
    this.pendingOnly.update((v) => !v);
    this.page.set(0);
    this.loadList(null);
  }

  goPage(delta: number): void {
    const next = this.page() + delta;
    if (next < 0 || next * this.pageSize >= this.total()) {
      return;
    }
    this.page.set(next);
    this.loadList(null);
  }

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));

  // ================= 詳情 =================

  select(id: number): void {
    this.selectedId.set(id);
    this.detailLoading.set(true);
    this.fieldErrors.set({});
    this.router.navigate([], { queryParams: { id }, replaceUrl: true });
    this.service.get(id).subscribe({
      next: (decision) => {
        this.applyDecision(decision);
        this.detailLoading.set(false);
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.fail(err);
      },
    });
    this.snapshot.set(null);
    this.service.snapshot(id).subscribe({
      next: (snap) => this.snapshot.set(snap),
      error: (err) => this.fail(err),
    });
  }

  private clearSelection(): void {
    this.selectedId.set(null);
    this.selected.set(null);
    this.snapshot.set(null);
  }

  /** 詳情與清單同步：寫入動作回傳的最新狀態也反映到左側清單那一列。 */
  private applyDecision(decision: Decision): void {
    this.selected.set(decision);
    this.decisions.update((list) => list.map((d) => (d.id === decision.id ? decision : d)));
    this.closeDate.set(todayIso());
    this.actualQty.set(null);
    this.selloutStatus.set(null);
    this.returnRatePct.set(null);
    this.marginPct.set(null);
    this.postNoteCode.set(null);
    this.postNoteText.set('');
    this.resultFormOpen.set(true);
  }

  openCreate(): void {
    const data: CreateDecisionDialogData = {};
    this.dialog
      .open(CreateDecisionDialogComponent, { data, maxWidth: '96vw', autoFocus: false })
      .afterClosed()
      .subscribe((created: Decision | undefined) => {
        if (created) {
          this.flash(`已建立決策：${created.productName}（${created.decision}），快照已鎖定`);
          this.decisionFilter.set('ALL');
          this.pendingOnly.set(false);
          this.page.set(0);
          this.loadList(created.id);
          this.loadAccuracy();
        }
      });
  }

  /** 開團＝品項標記上架（§7.4 ADOPTED → LISTED），走 FR-03 既有端點。 */
  launch(): void {
    const d = this.selected();
    if (!d) {
      return;
    }
    this.dialogService
      .Confirm({
        title: '標記開團',
        message: `將「${d.productName}」標記為已上架（LISTED）。開團後才能標記結案。`,
        confirmText: '標記開團',
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.acting.set(true);
        this.service.markListed(d.productId).subscribe({
          next: () => this.afterAction('已標記開團', d.id),
          error: (err) => this.failAction(err),
        });
      });
  }

  close(): void {
    const d = this.selected();
    if (!d) {
      return;
    }
    this.acting.set(true);
    this.fieldErrors.set({});
    this.service.close(d.id, this.closeDate() || null).subscribe({
      next: (updated) => {
        this.acting.set(false);
        this.applyDecision(updated);
        this.flash('已標記結案，結案 7 天後仍未回填會出現在儀表板待辦區');
      },
      error: (err) => this.failAction(err),
    });
  }

  submitResult(): void {
    const d = this.selected();
    if (!d || !this.canSubmitResult()) {
      return;
    }
    this.acting.set(true);
    this.fieldErrors.set({});
    this.service
      .fillResult(d.id, {
        actualQty: this.actualQty()!,
        selloutStatus: this.selloutStatus()!,
        returnRate: pctToRate(this.returnRatePct()),
        realizedMarginRate: pctToRate(this.marginPct())!,
        postNoteCode: this.postNoteCode(),
        postNoteText: this.postNoteText().trim() || null,
      })
      .subscribe({
        next: (updated) => {
          this.acting.set(false);
          this.applyDecision(updated);
          this.flash('已送出回填，準確度指標已更新');
          this.loadAccuracy();
        },
        error: (err) => this.failAction(err),
      });
  }

  review(): void {
    const d = this.selected();
    if (!d) {
      return;
    }
    this.dialogService
      .Confirm({ title: '覆核決策', message: `確認覆核「${d.productName}」的 ${d.decision} 決策？`, confirmText: '覆核' })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.acting.set(true);
        this.service.review(d.id).subscribe({
          next: (updated) => {
            this.acting.set(false);
            this.applyDecision(updated);
            this.flash('已覆核');
          },
          error: (err) => this.failAction(err),
        });
      });
  }

  private afterAction(message: string, id: number): void {
    this.acting.set(false);
    this.flash(message);
    this.select(id);
  }

  // ================= 準確度 =================

  loadAccuracy(): void {
    const range = this.accRange();
    const from = range === 'ALL' ? null : daysAgoIso(range === '4W' ? 28 : 84);
    this.service
      .accuracy({ from, to: null, categoryId: this.accCategoryId(), decidedBy: this.accDecidedBy() })
      .subscribe({ next: (acc) => this.accuracy.set(acc), error: (err) => this.fail(err) });
  }

  setAccRange(range: AccuracyRange): void {
    this.accRange.set(range);
    this.loadAccuracy();
  }

  /** 決策者下拉：取最近 100 筆決策中出現過的決策者（系統沒有給一般角色的使用者清單 API）。 */
  private loadDeciders(): void {
    this.service.list({ page: 0, size: 100 }).subscribe({
      next: (page) => {
        const seen = new Map<number, string>();
        for (const d of page.content) {
          seen.set(d.decidedById, d.decidedByName);
        }
        this.deciders.set([...seen].map(([id, name]) => ({ id, name })));
      },
      error: () => {},
    });
  }

  // ================= 顯示輔助 =================

  pct(value: number | null | undefined, digits = 0): string {
    return value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;
  }

  date(value: string | null | undefined): string {
    return value ? value.substring(0, 10) : '—';
  }

  /** 逾期回填一律用警示色，其餘依階段（AC-11-3）。 */
  stageClass(stage: DecisionStage, overdue: number | null): string {
    return overdue ? 'status-warn' : STAGE_BADGE_CLASS[stage];
  }

  decisionClass(type: DecisionType | null): string {
    return type ? DECISION_BADGE_CLASS[type] : 'override-badge';
  }

  sourceEntries(record: Record<string, string> | null): { code: string; value: string }[] {
    return Object.entries(record ?? {}).map(([code, value]) => ({ code, value }));
  }

  private hasRole(roles: UserRole[]): boolean {
    return this.auth.hasRole(roles);
  }

  private flash(message: string): void {
    this.errorMessage.set(null);
    this.successMessage.set(message);
    setTimeout(() => {
      if (this.successMessage() === message) {
        this.successMessage.set(null);
      }
    }, 4000);
  }

  private failAction(err: unknown): void {
    this.acting.set(false);
    this.fail(err);
  }

  private fail(err: unknown): void {
    const apiError = err instanceof HttpErrorResponse ? err.error?.error : null;
    this.successMessage.set(null);
    this.errorMessage.set(apiError?.message ?? '操作失敗，請稍後再試');
    const fields: Record<string, string> = {};
    for (const fe of apiError?.fieldErrors ?? []) {
      fields[fe.field] = fe.message;
    }
    this.fieldErrors.set(fields);
  }
}

function todayIso(): string {
  return toIso(new Date());
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toIso(d);
}

/** 以瀏覽器本地日期組 yyyy-MM-dd，不用 toISOString（那是 UTC，台灣早上 8 點前會差一天）。 */
function toIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 百分比輸入換回 0–1、四位小數（後端 DECIMAL(5,4)）。 */
function pctToRate(pct: number | null): number | null {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return null;
  }
  return Math.round(pct * 100) / 10000;
}
