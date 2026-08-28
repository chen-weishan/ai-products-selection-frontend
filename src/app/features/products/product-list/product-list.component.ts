import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { SelectionModel } from '@angular/cdk/collections';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  filter,
  map,
  Observable,
  switchMap,
  tap,
} from 'rxjs';
import { DialogService } from '../../../services/dialog-service';
import { ProductReferenceService } from '../product-reference.service';
import { ProductSearchCriteria, ProductService } from '../product.service';

type TrackType = NonNullable<ProductSearchCriteria['trackType']>;
type SourcingStatus = NonNullable<ProductSearchCriteria['sourcingStatus']>;
type ProductStatus = NonNullable<ProductSearchCriteria['status']>;
type Grade = NonNullable<ProductSearchCriteria['grade']>;

const PAGE_SIZES = [20, 50, 100] as const;
const TRACK_TYPES = ['A', 'B'] as const;
const SOURCING_STATUSES = ['PENDING', 'SOURCING', 'URGENT', 'PROMOTED', 'REJECTED'] as const;
const PRODUCT_STATUSES = [
  'DRAFT',
  'EVALUATING',
  'WATCHING',
  'ADOPTED',
  'LISTED',
  'REJECTED',
] as const;
const GRADES = ['A', 'B', 'C'] as const;
const SORT_FIELDS = new Set([
  'name',
  'categoryName',
  'supplierName',
  'cost',
  'suggestedPrice',
  'marginRate',
  'latestScore',
  'grade',
  'timeGapDays',
  'trackType',
  'sourcingStatus',
  'status',
  'updatedAt',
]);
const DEFAULT_SORT = 'latestScore,desc';

const SOURCING_STATUS_LABELS: Record<SourcingStatus, string> = {
  PENDING: '待評估',
  SOURCING: '尋源中',
  URGENT: '需加速',
  PROMOTED: '已成案',
  REJECTED: '已淘汰',
};
const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: '草稿',
  EVALUATING: '評估中',
  WATCHING: '觀察中',
  ADOPTED: '已採納',
  LISTED: '已上架',
  REJECTED: '已淘汰',
};

@Component({
  selector: 'app-product-list',
  imports: [
    DatePipe,
    DecimalPipe,
    PercentPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
  ],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  readonly productService = inject(ProductService);
  readonly references = inject(ProductReferenceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogService = inject(DialogService);

  readonly pageSizes = PAGE_SIZES;
  readonly trackTypes = TRACK_TYPES;
  readonly sourcingStatuses = SOURCING_STATUSES;
  readonly productStatuses = PRODUCT_STATUSES;
  readonly grades = GRADES;
  readonly criteria = signal<ProductSearchCriteria>({
    page: 0,
    size: 20,
    sort: [DEFAULT_SORT],
  });
  readonly selection = new SelectionModel<number>(true);
  readonly batchCategoryId = new FormControl<number | null>(null);

  readonly filterForm = new FormGroup({
    keyword: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl<number | null>(null),
    supplierId: new FormControl<number | null>(null),
    trackType: new FormControl<TrackType | null>(null),
    sourcingStatus: new FormControl<SourcingStatus | null>(null),
    status: new FormControl<ProductStatus | null>(null),
    grade: new FormControl<Grade | null>(null),
    minScore: new FormControl<number | null>(null),
    maxScore: new FormControl<number | null>(null),
    hasRisk: new FormControl(false, { nonNullable: true }),
  });

  readonly sortActive = computed(() => this.criteria().sort?.[0]?.split(',')[0] ?? 'latestScore');
  readonly sortDirection = computed<SortDirection>(() =>
    this.criteria().sort?.[0]?.split(',')[1]?.toLowerCase() === 'asc' ? 'asc' : 'desc',
  );

  readonly displayedColumns = [
    'select',
    'name',
    'category',
    'trackType',
    'supplier',
    'cost',
    'price',
    'margin',
    'score',
    'gradeOrGap',
    'status',
    'updatedAt',
    'actions',
  ];

  ngOnInit(): void {
    this.references
      .load()
      .pipe(
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.route.queryParamMap
      .pipe(
        map((params) => criteriaFromQueryParams(params)),
        distinctUntilChanged(criteriaEqual),
        tap((criteria) => {
          this.selection.clear();
          this.criteria.set(criteria);
          this.applyCriteriaToForm(criteria);
        }),
        switchMap((criteria) => this.productService.load(criteria).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.filterForm.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const trackType = this.filterForm.controls.trackType.value;
        this.configureScoreControls(trackType, true);
        this.navigateToCriteria(this.criteriaFromForm(), true);
      });
  }

  clearFilters(): void {
    this.filterForm.controls.minScore.enable({ emitEvent: false });
    this.filterForm.controls.maxScore.enable({ emitEvent: false });
    this.filterForm.reset({
      keyword: '',
      categoryId: null,
      supplierId: null,
      trackType: null,
      sourcingStatus: null,
      status: null,
      grade: null,
      minScore: null,
      maxScore: null,
      hasRisk: false,
    });
  }

  retry(): void {
    this.productService.load(this.criteria()).subscribe({
      error: () => undefined,
    });
  }

  onPage(event: PageEvent): void {
    this.navigateToCriteria(
      {
        ...this.criteria(),
        page: event.pageIndex,
        size: event.pageSize as 20 | 50 | 100,
      },
      false,
    );
  }

  onSort(sort: Sort): void {
    if (!sort.direction) {
      return;
    }
    this.navigateToCriteria(
      {
        ...this.criteria(),
        page: 0,
        sort: [`${sort.active},${sort.direction}`],
      },
      false,
    );
  }

  isAllSelected(): boolean {
    const selectableIds = this.currentPageIds();
    return selectableIds.length > 0 && selectableIds.every((id) => this.selection.isSelected(id));
  }

  isPartiallySelected(): boolean {
    const selectableIds = this.currentPageIds();
    const selectedCount = selectableIds.filter((id) => this.selection.isSelected(id)).length;
    return selectedCount > 0 && selectedCount < selectableIds.length;
  }

  toggleAllRows(): void {
    const selectableIds = this.currentPageIds();
    if (this.isAllSelected()) {
      selectableIds.forEach((id) => this.selection.deselect(id));
      return;
    }
    selectableIds.forEach((id) => this.selection.select(id));
  }

  toggleRow(id: number | undefined): void {
    if (id != null) {
      this.selection.toggle(id);
    }
  }

  analyzeSelected(): void {
    const productIds = [...this.selection.selected];
    if (productIds.length === 0 || this.productService.batchLoading()) {
      return;
    }

    this.productService
      .analyzeBatch(productIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.selection.clear(),
        error: () => undefined,
      });
  }

  assignSelectedCategory(): void {
    const productIds = [...this.selection.selected];
    const categoryId = this.batchCategoryId.value;
    if (productIds.length === 0 || categoryId == null || this.productService.batchLoading()) {
      return;
    }

    this.runBatchAndReload(this.productService.assignCategory(productIds, categoryId));
  }

  disableSelected(): void {
    const productIds = [...this.selection.selected];
    if (productIds.length === 0 || this.productService.batchLoading()) {
      return;
    }

    this.dialogService
      .Confirm({
        title: '批次停用品項',
        message: `確定要停用已選取的 ${productIds.length} 筆品項嗎？停用後將不再出現在清單中。`,
        confirmText: '確認停用',
        cancelText: '取消',
        isDanger: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.productService.disableBatch(productIds)),
        tap(() => this.selection.clear()),
        switchMap(() => this.productService.load(this.criteria())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }

  sourcingStatusLabel(status: SourcingStatus): string {
    return SOURCING_STATUS_LABELS[status];
  }

  productStatusLabel(status: ProductStatus): string {
    return PRODUCT_STATUS_LABELS[status];
  }

  statusLabel(status: SourcingStatus | ProductStatus | undefined): string {
    if (!status) {
      return '—';
    }
    return (
      SOURCING_STATUS_LABELS[status as SourcingStatus] ??
      PRODUCT_STATUS_LABELS[status as ProductStatus] ??
      status
    );
  }

  private applyCriteriaToForm(criteria: ProductSearchCriteria): void {
    this.filterForm.patchValue(
      {
        keyword: criteria.keyword ?? '',
        categoryId: criteria.categoryId ?? null,
        supplierId: criteria.supplierId ?? null,
        trackType: criteria.trackType ?? null,
        sourcingStatus: criteria.sourcingStatus ?? null,
        status: criteria.status ?? null,
        grade: criteria.grade ?? null,
        minScore: criteria.minScore ?? null,
        maxScore: criteria.maxScore ?? null,
        hasRisk: criteria.hasRisk === true,
      },
      { emitEvent: false },
    );
    this.configureScoreControls(criteria.trackType ?? null, true);
  }

  private configureScoreControls(trackType: TrackType | null, clear: boolean): void {
    const minScore = this.filterForm.controls.minScore;
    const maxScore = this.filterForm.controls.maxScore;

    if (trackType === 'B') {
      if (clear) {
        minScore.setValue(null, { emitEvent: false });
        maxScore.setValue(null, { emitEvent: false });
      }
      minScore.disable({ emitEvent: false });
      maxScore.disable({ emitEvent: false });
      return;
    }

    minScore.enable({ emitEvent: false });
    maxScore.enable({ emitEvent: false });
  }

  private criteriaFromForm(): ProductSearchCriteria {
    const value = this.filterForm.getRawValue();
    const trackB = value.trackType === 'B';
    const keyword = value.keyword.trim();

    return compactCriteria({
      keyword: keyword || undefined,
      categoryId: value.categoryId ?? undefined,
      supplierId: value.supplierId ?? undefined,
      trackType: value.trackType ?? undefined,
      sourcingStatus: value.sourcingStatus ?? undefined,
      status: value.status ?? undefined,
      grade: value.grade ?? undefined,
      minScore: trackB ? undefined : (value.minScore ?? undefined),
      maxScore: trackB ? undefined : (value.maxScore ?? undefined),
      hasRisk: value.hasRisk ? true : undefined,
      page: 0,
      size: this.criteria().size ?? 20,
      sort: this.criteria().sort ?? [DEFAULT_SORT],
    });
  }

  private navigateToCriteria(criteria: ProductSearchCriteria, replaceUrl: boolean): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: criteriaToQueryParams(criteria),
      replaceUrl,
    });
  }

  private currentPageIds(): number[] {
    return this.productService
      .products()
      .flatMap((product) => (product.id == null ? [] : [product.id]));
  }

  private runBatchAndReload(action: Observable<unknown>): void {
    action
      .pipe(
        tap(() => {
          this.selection.clear();
          this.batchCategoryId.setValue(null);
        }),
        switchMap(() => this.productService.load(this.criteria())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }
}

function criteriaFromQueryParams(params: ParamMap): ProductSearchCriteria {
  const trackType = enumParam(params.get('trackType'), TRACK_TYPES);
  const page = nonNegativeInteger(params.get('page')) ?? 0;
  const requestedSize = nonNegativeInteger(params.get('size'));
  const size = PAGE_SIZES.includes(requestedSize as (typeof PAGE_SIZES)[number])
    ? (requestedSize as 20 | 50 | 100)
    : 20;

  return compactCriteria({
    keyword: params.get('keyword')?.trim() || undefined,
    categoryId: positiveInteger(params.get('categoryId')),
    supplierId: positiveInteger(params.get('supplierId')),
    trackType,
    sourcingStatus: enumParam(params.get('sourcingStatus'), SOURCING_STATUSES),
    status: enumParam(params.get('status'), PRODUCT_STATUSES),
    grade: enumParam(params.get('grade'), GRADES),
    minScore: trackType === 'B' ? undefined : decimalNumber(params.get('minScore')),
    maxScore: trackType === 'B' ? undefined : decimalNumber(params.get('maxScore')),
    hasRisk: params.get('hasRisk') === 'true' ? true : undefined,
    page,
    size,
    sort: [validSort(params.getAll('sort')[0])],
  });
}

function criteriaToQueryParams(criteria: ProductSearchCriteria): Record<string, unknown> {
  return {
    keyword: criteria.keyword ?? null,
    categoryId: criteria.categoryId ?? null,
    supplierId: criteria.supplierId ?? null,
    trackType: criteria.trackType ?? null,
    sourcingStatus: criteria.sourcingStatus ?? null,
    status: criteria.status ?? null,
    grade: criteria.grade ?? null,
    minScore: criteria.trackType === 'B' ? null : (criteria.minScore ?? null),
    maxScore: criteria.trackType === 'B' ? null : (criteria.maxScore ?? null),
    hasRisk: criteria.hasRisk === true ? true : null,
    page: criteria.page ?? 0,
    size: criteria.size ?? 20,
    sort: criteria.sort ?? [DEFAULT_SORT],
  };
}

function compactCriteria(criteria: ProductSearchCriteria): ProductSearchCriteria {
  return Object.fromEntries(
    Object.entries(criteria).filter(([, value]) => value !== undefined),
  ) as ProductSearchCriteria;
}

function criteriaEqual(left: ProductSearchCriteria, right: ProductSearchCriteria): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function enumParam<T extends string>(value: string | null, values: readonly T[]): T | undefined {
  return value && values.includes(value as T) ? (value as T) : undefined;
}

function nonNegativeInteger(value: string | null): number | undefined {
  if (value == null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function positiveInteger(value: string | null): number | undefined {
  const parsed = nonNegativeInteger(value);
  return parsed != null && parsed > 0 ? parsed : undefined;
}

function decimalNumber(value: string | null): number | undefined {
  if (value == null || value.trim() === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validSort(value: string | undefined): string {
  if (!value) {
    return DEFAULT_SORT;
  }
  const [field, direction] = value.split(',');
  const normalizedDirection = direction?.toLowerCase();
  return SORT_FIELDS.has(field) && (normalizedDirection === 'asc' || normalizedDirection === 'desc')
    ? `${field},${normalizedDirection}`
    : DEFAULT_SORT;
}
