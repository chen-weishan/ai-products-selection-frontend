import { DecimalPipe, Location, PercentPipe } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormArray,
  FormGroup,
  AbstractControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, filter, forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';
import { ProductResponse } from '../../../api/model/models';
import { DialogService } from '../../../services/dialog-service';
import { ProductEditorService, ProductSaveRequest } from '../product-editor.service';
import {
  ProductImageService,
  ProductImageUploadError,
  ProductImageView,
} from '../product-image.service';
import { ProductReferenceService } from '../product-reference.service';
import { ProductFestivalAffinity, ProductSupplementService } from '../product-supplement.service';

type TrackType = 'A' | 'B';
type Season = 'ALL' | 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER' | 'FESTIVAL';
type SourcingStatus = 'PENDING' | 'SOURCING' | 'URGENT' | 'PROMOTED' | 'REJECTED';
type LogisticsCondition = 'NORMAL' | 'CHILLED' | 'FROZEN' | 'FRAGILE' | 'MELTABLE' | 'OVERSIZED';

interface PendingImage {
  file: File;
  previewUrl: string;
}

type FestivalAffinityGroup = FormGroup<{
  festivalCode: FormControl<string | null>;
  affinity: FormControl<number | null>;
}>;

const SEASONS: readonly { value: Season; label: string }[] = [
  { value: 'ALL', label: '全年' },
  { value: 'SPRING', label: '春季' },
  { value: 'SUMMER', label: '夏季' },
  { value: 'AUTUMN', label: '秋季' },
  { value: 'WINTER', label: '冬季' },
  { value: 'FESTIVAL', label: '節慶' },
];
const SOURCING_STATUSES: readonly { value: SourcingStatus; label: string }[] = [
  { value: 'PENDING', label: '待評估' },
  { value: 'SOURCING', label: '尋源中' },
  { value: 'URGENT', label: '需加速' },
  { value: 'PROMOTED', label: '已成案' },
  { value: 'REJECTED', label: '已淘汰' },
];
const LOGISTICS_CONDITIONS: readonly { value: LogisticsCondition; label: string }[] = [
  { value: 'NORMAL', label: '常溫' },
  { value: 'CHILLED', label: '冷藏' },
  { value: 'FROZEN', label: '冷凍' },
  { value: 'FRAGILE', label: '易碎' },
  { value: 'MELTABLE', label: '易融化' },
  { value: 'OVERSIZED', label: '大型材積' },
];
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_REVIEW_CSV_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-product-form',
  imports: [
    PercentPipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit, OnDestroy {
  readonly editor = inject(ProductEditorService);
  readonly images = inject(ProductImageService);
  readonly references = inject(ProductReferenceService);
  readonly supplements = inject(ProductSupplementService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogService = inject(DialogService);
  private readonly location = inject(Location);

  readonly productId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.productId() != null);
  readonly submittingDraft = signal(false);
  readonly pendingImages = signal<readonly PendingImage[]>([]);
  readonly fileError = signal<string | null>(null);
  readonly warnings = signal<readonly string[]>([]);
  readonly reviewFile = signal<File | null>(null);
  readonly reviewFileError = signal<string | null>(null);
  readonly seasons = SEASONS;
  readonly sourcingStatuses = SOURCING_STATUSES;
  readonly logisticsConditions = LOGISTICS_CONDITIONS;

  readonly form = new FormGroup(
    {
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, nonBlankValidator, Validators.maxLength(100)],
      }),
      categoryId: new FormControl<number | null>(null, Validators.required),
      supplierId: new FormControl<number | null>(null),
      trackType: new FormControl<TrackType>('A', { nonNullable: true }),
      sourcingStatus: new FormControl<SourcingStatus | null>(null),
      cost: new FormControl<number | null>(null, Validators.min(0)),
      suggestedPrice: new FormControl<number | null>(null, Validators.min(0.01)),
      moq: new FormControl<number | null>(null, [Validators.min(1), positiveIntegerValidator]),
      shelfLifeDays: new FormControl<number | null>(null, [
        Validators.min(1),
        positiveIntegerValidator,
      ]),
      season: new FormControl<Season>('ALL', { nonNullable: true }),
      logisticsConditions: new FormControl<LogisticsCondition[]>([], { nonNullable: true }),
      idealTempMin: new FormControl<number | null>(null),
      idealTempMax: new FormControl<number | null>(null),
      keywordIds: new FormControl<number[]>([], { nonNullable: true }),
      festivalAffinities: new FormArray<FestivalAffinityGroup>([], {
        validators: duplicateFestivalValidator,
      }),
    },
    { validators: () => this.validateBusinessRules() },
  );

  readonly marginRate = signal<number | null>(null);
  readonly totalImageCount = computed(
    () => this.images.images().length + this.pendingImages().length,
  );

  get festivalAffinities(): FormArray<FestivalAffinityGroup> {
    return this.form.controls.festivalAffinities;
  }

  ngOnInit(): void {
    const routeId = this.route.snapshot.paramMap.get('id');
    const parsedProductId = routeId == null ? null : Number(routeId);
    if (routeId != null && (!Number.isInteger(parsedProductId) || (parsedProductId ?? 0) <= 0)) {
      void this.router.navigate(['/products']);
      return;
    }
    const productId = parsedProductId;
    this.productId.set(productId);
    this.configureTrackControls(this.form.controls.trackType.value);

    forkJoin([
      this.references.load(),
      this.references.loadTrendKeywords(),
      this.supplements.loadFestivals(),
    ])
      .pipe(
        switchMap(() => (productId == null ? of(null) : this.editor.load(productId))),
        tap((product) => {
          if (product) this.patchProduct(product);
        }),
        switchMap(() =>
          productId == null
            ? of({ images: [] as readonly ProductImageView[], affinities: [] })
            : forkJoin({
                images: this.images.load(productId),
                affinities: this.supplements.loadAffinities(productId),
              }),
        ),
        tap(({ affinities }) => this.patchFestivalAffinities(affinities)),
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.trackType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((trackType) => {
        this.configureTrackControls(trackType);
        this.form.updateValueAndValidity({ emitEvent: false });
      });

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.updateMarginRate();
      this.editor.clearError();
    });
  }

  ngOnDestroy(): void {
    this.pendingImages().forEach((image) => URL.revokeObjectURL(image.previewUrl));
    this.images.clear();
    this.supplements.clear();
  }

  save(saveAsDraft: boolean): void {
    this.submittingDraft.set(saveAsDraft);
    this.warnings.set([]);
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();
    if (
      this.form.invalid ||
      this.editor.saving() ||
      this.images.loading() ||
      this.supplements.loading()
    )
      return;

    this.editor
      .save(this.productId(), this.buildRequest(saveAsDraft))
      .pipe(
        tap((result) => this.warnings.set(result.warnings)),
        switchMap((result) => {
          if (this.productId() == null) {
            this.productId.set(result.product.id!);
            this.location.replaceState(`/products/${result.product.id}/edit`);
          }
          const productId = result.product.id!;
          const files = this.pendingImages().map((image) => image.file);
          const actions: Observable<unknown>[] = [];
          if (files.length > 0) actions.push(this.images.uploadFiles(productId, files));
          actions.push(
            this.supplements.saveAffinities(
              productId,
              this.form.controls.trackType.value === 'B' ? [] : this.affinityPayload(),
            ),
          );
          const reviewFile = this.reviewFile();
          if (this.form.controls.trackType.value === 'A' && reviewFile) {
            actions.push(this.supplements.uploadReviewFile(productId, reviewFile));
          }
          return forkJoin(actions).pipe(map(() => result));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.clearPendingImages();
          this.reviewFile.set(null);
          this.reviewFileError.set(null);
          const warningText = result.warnings.length ? `；${result.warnings.join('、')}` : '';
          this.snackBar.open(`品項已儲存${warningText}`, '關閉', { duration: 5000 });
          void this.router.navigate(['/products']);
        },
        error: (error: unknown) => {
          if (error instanceof ProductImageUploadError && error.uploadedCount > 0) {
            this.removeUploadedPendingImages(error.uploadedCount);
          }
        },
      });
  }

  addFestivalAffinity(): void {
    if (this.festivalAffinities.length >= 50) return;
    this.festivalAffinities.push(createFestivalAffinityGroup());
  }

  removeFestivalAffinity(index: number): void {
    this.festivalAffinities.removeAt(index);
  }

  onReviewFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    this.reviewFileError.set(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.reviewFileError.set('評論檔案必須是 CSV 格式');
      return;
    }
    if (file.size > MAX_REVIEW_CSV_BYTES) {
      this.reviewFileError.set('評論 CSV 不可超過 2 MB');
      return;
    }
    this.reviewFile.set(file);
  }

  removeReviewFile(): void {
    this.reviewFile.set(null);
    this.reviewFileError.set(null);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.fileError.set(null);
    const availableSlots = MAX_IMAGES - this.totalImageCount();
    if (files.length > availableSlots) {
      this.fileError.set(`品項圖片最多 ${MAX_IMAGES} 張，目前只能再選 ${availableSlots} 張`);
      return;
    }
    const invalidType = files.find((file) => !IMAGE_TYPES.has(file.type));
    if (invalidType) {
      this.fileError.set(`「${invalidType.name}」不是 JPG 或 PNG 圖片`);
      return;
    }
    const oversized = files.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      this.fileError.set(`「${oversized.name}」超過 2 MB`);
      return;
    }
    this.pendingImages.update((current) => [
      ...current,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  }

  removePendingImage(image: PendingImage): void {
    URL.revokeObjectURL(image.previewUrl);
    this.pendingImages.update((images) => images.filter((candidate) => candidate !== image));
  }

  deleteImage(image: ProductImageView): void {
    const productId = this.productId();
    if (productId == null || image.id == null) return;
    this.dialogService
      .Confirm({
        title: '刪除品項圖片',
        message: '確定要刪除這張圖片嗎？此操作無法復原。',
        confirmText: '確認刪除',
        cancelText: '取消',
        isDanger: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.images.delete(productId, image.id!)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }

  moveImage(index: number, direction: -1 | 1): void {
    const productId = this.productId();
    const current = [...this.images.images()];
    const target = index + direction;
    if (productId == null || target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    const imageIds = current.flatMap((image) => (image.id == null ? [] : [image.id]));
    this.images.reorder(productId, imageIds).subscribe({ error: () => undefined });
  }

  private configureTrackControls(trackType: TrackType): void {
    const sourcingStatus = this.form.controls.sourcingStatus;
    const aOnlyControls: readonly AbstractControl[] = [
      this.form.controls.supplierId,
      this.form.controls.cost,
      this.form.controls.suggestedPrice,
      this.form.controls.moq,
      this.form.controls.shelfLifeDays,
      this.form.controls.season,
      this.form.controls.logisticsConditions,
      this.form.controls.idealTempMin,
      this.form.controls.idealTempMax,
      this.form.controls.festivalAffinities,
    ];
    if (trackType === 'B') {
      aOnlyControls.forEach((control) => control.disable({ emitEvent: false }));
      sourcingStatus.enable({ emitEvent: false });
      if (sourcingStatus.value == null) sourcingStatus.setValue('PENDING', { emitEvent: false });
      this.reviewFile.set(null);
      this.reviewFileError.set(null);
      return;
    }
    aOnlyControls.forEach((control) => control.enable({ emitEvent: false }));
    sourcingStatus.setValue(null, { emitEvent: false });
    sourcingStatus.disable({ emitEvent: false });
  }

  private validateBusinessRules(): ValidationErrors | null {
    const value = this.form?.getRawValue();
    if (!value) return null;
    const errors: ValidationErrors = {};
    if (!this.submittingDraft()) {
      if (value.trackType === 'A') {
        if (value.cost == null) errors['costRequired'] = true;
        if (value.suggestedPrice == null) errors['suggestedPriceRequired'] = true;
      }
      if (value.trackType === 'B' && value.keywordIds.length === 0) {
        errors['keywordRequired'] = true;
      }
    }
    if (
      value.trackType === 'A' &&
      value.cost != null &&
      value.suggestedPrice != null &&
      value.suggestedPrice <= value.cost
    ) {
      errors['invalidPrice'] = true;
    }
    if (value.trackType === 'A' && (value.idealTempMin == null) !== (value.idealTempMax == null)) {
      errors['incompleteTemperature'] = true;
    } else if (
      value.trackType === 'A' &&
      value.idealTempMin != null &&
      value.idealTempMax != null &&
      value.idealTempMin > value.idealTempMax
    ) {
      errors['invalidTemperature'] = true;
    }
    if (value.keywordIds.length > 5) errors['tooManyKeywords'] = true;
    return Object.keys(errors).length ? errors : null;
  }

  private updateMarginRate(): void {
    const cost = this.form.controls.cost.value;
    const price = this.form.controls.suggestedPrice.value;
    this.marginRate.set(
      cost != null && price != null && price > cost ? (price - cost) / price : null,
    );
  }

  private buildRequest(saveAsDraft: boolean): ProductSaveRequest {
    const value = this.form.getRawValue();
    const trackB = value.trackType === 'B';
    return {
      name: value.name.trim(),
      categoryId: value.categoryId!,
      supplierId: trackB ? undefined : (value.supplierId ?? undefined),
      cost: trackB ? undefined : (value.cost ?? undefined),
      suggestedPrice: trackB ? undefined : (value.suggestedPrice ?? undefined),
      moq: trackB ? undefined : (value.moq ?? undefined),
      shelfLifeDays: trackB ? undefined : (value.shelfLifeDays ?? undefined),
      season: trackB ? undefined : value.season,
      trackType: value.trackType,
      sourcingStatus: trackB ? (value.sourcingStatus ?? 'PENDING') : undefined,
      logisticsConditions: trackB ? undefined : [...value.logisticsConditions],
      idealTempMin: trackB ? undefined : (value.idealTempMin ?? undefined),
      idealTempMax: trackB ? undefined : (value.idealTempMax ?? undefined),
      keywordIds: [...value.keywordIds],
      saveAsDraft,
    };
  }

  private patchProduct(product: ProductResponse): void {
    this.form.patchValue(
      {
        name: product.name ?? '',
        categoryId: product.categoryId ?? null,
        supplierId: product.supplierId ?? null,
        trackType: product.trackType ?? 'A',
        sourcingStatus: product.sourcingStatus ?? null,
        cost: product.cost ?? null,
        suggestedPrice: product.suggestedPrice ?? null,
        moq: product.moq ?? null,
        shelfLifeDays: product.shelfLifeDays ?? null,
        season: product.season ?? 'ALL',
        logisticsConditions: Array.from(product.logisticsConditions ?? []),
        idealTempMin: product.idealTempMin ?? null,
        idealTempMax: product.idealTempMax ?? null,
        keywordIds: Array.from(product.keywordIds ?? []),
      },
      { emitEvent: false },
    );
    this.configureTrackControls(product.trackType ?? 'A');
    this.updateMarginRate();
  }

  private patchFestivalAffinities(affinities: readonly ProductFestivalAffinity[]): void {
    this.festivalAffinities.clear({ emitEvent: false });
    affinities.forEach((affinity) =>
      this.festivalAffinities.push(
        createFestivalAffinityGroup(affinity.festivalCode, affinity.affinity),
        { emitEvent: false },
      ),
    );
  }

  private affinityPayload(): readonly Pick<ProductFestivalAffinity, 'festivalCode' | 'affinity'>[] {
    return this.festivalAffinities.getRawValue().map((affinity) => ({
      festivalCode: affinity.festivalCode!,
      affinity: affinity.affinity!,
    }));
  }

  private clearPendingImages(): void {
    this.pendingImages().forEach((image) => URL.revokeObjectURL(image.previewUrl));
    this.pendingImages.set([]);
  }

  private removeUploadedPendingImages(uploadedCount: number): void {
    const current = this.pendingImages();
    current.slice(0, uploadedCount).forEach((image) => URL.revokeObjectURL(image.previewUrl));
    this.pendingImages.set(current.slice(uploadedCount));
  }
}

function nonBlankValidator(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim().length === 0
    ? { blank: true }
    : null;
}

function positiveIntegerValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;
  return value == null || (Number.isInteger(value) && value > 0) ? null : { integer: true };
}

function createFestivalAffinityGroup(
  festivalCode: string | null = null,
  affinity: number | null = null,
): FestivalAffinityGroup {
  return new FormGroup({
    festivalCode: new FormControl<string | null>(festivalCode, Validators.required),
    affinity: new FormControl<number | null>(affinity, [
      Validators.required,
      Validators.min(0),
      Validators.max(1),
    ]),
  });
}

function duplicateFestivalValidator(control: AbstractControl): ValidationErrors | null {
  const values = (control.value ?? []) as { festivalCode?: string | null }[];
  const codes = values.flatMap((value) => (value.festivalCode ? [value.festivalCode] : []));
  return new Set(codes).size === codes.length ? null : { duplicateFestival: true };
}
