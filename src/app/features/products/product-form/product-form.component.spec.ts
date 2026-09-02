import { signal } from '@angular/core';
import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { DialogService } from '../../../services/dialog-service';
import { AccessControlService } from '../../../core/auth/access-control.service';
import { ProductEditorService } from '../product-editor.service';
import { ProductImageService } from '../product-image.service';
import { ProductReferenceService } from '../product-reference.service';
import { ProductSupplementService } from '../product-supplement.service';
import { ProductService } from '../product.service';
import { ProductFormComponent } from './product-form.component';

describe('ProductFormComponent', () => {
  const loadCategories = vi.fn();
  const loadSuppliers = vi.fn();
  const loadTrendKeywords = vi.fn();
  const loadCategoryMarginMedian = vi.fn();
  const clearCategoryMarginMedian = vi.fn();
  const loadProduct = vi.fn();
  const saveProduct = vi.fn();
  const loadImages = vi.fn();
  const uploadFiles = vi.fn();
  const reorderImages = vi.fn();
  const deleteImage = vi.fn();
  const clearImages = vi.fn();
  const loadFestivals = vi.fn();
  const loadAffinities = vi.fn();
  const loadReviewSummary = vi.fn();
  const saveAffinities = vi.fn();
  const uploadReviewFile = vi.fn();
  const analyzeBatch = vi.fn();
  const clearSupplements = vi.fn();
  const navigate = vi.fn();
  const snackOpen = vi.fn();
  const replaceState = vi.fn();
  let component: ProductFormComponent;
  let fixture: ComponentFixture<ProductFormComponent>;

  beforeEach(async () => {
    [
      loadCategories,
      loadSuppliers,
      loadTrendKeywords,
      loadCategoryMarginMedian,
      clearCategoryMarginMedian,
      loadProduct,
      saveProduct,
      loadImages,
      uploadFiles,
      reorderImages,
      deleteImage,
      clearImages,
      loadFestivals,
      loadAffinities,
      loadReviewSummary,
      saveAffinities,
      uploadReviewFile,
      analyzeBatch,
      clearSupplements,
      navigate,
      snackOpen,
      replaceState,
    ].forEach((mock) => mock.mockReset());
    loadCategories.mockReturnValue(of([{ id: 10, label: '零食' }]));
    loadSuppliers.mockReturnValue(of([{ id: 20, name: '測試供應商' }]));
    loadTrendKeywords.mockReturnValue(of(undefined));
    loadCategoryMarginMedian.mockReturnValue(
      of({
        categoryId: 10,
        categoryName: '零食',
        medianMarginRate: 0.3,
        sampleCount: 12,
      }),
    );
    loadImages.mockReturnValue(of([]));
    uploadFiles.mockReturnValue(of([]));
    reorderImages.mockReturnValue(of([]));
    deleteImage.mockReturnValue(of([]));
    loadFestivals.mockReturnValue(of([]));
    loadAffinities.mockReturnValue(of([]));
    loadReviewSummary.mockReturnValue(of({ totalReviewCount: 12, lowConfidence: true }));
    saveAffinities.mockReturnValue(of([]));
    uploadReviewFile.mockReturnValue(
      of({
        fileName: 'reviews.csv',
        acceptedRows: 1,
        insertedCount: 1,
        duplicateCount: 0,
        totalReviewCount: 1,
        lowConfidence: true,
      }),
    );
    analyzeBatch.mockReturnValue(of({ queuedCount: 1 }));
    navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ProductFormComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
        { provide: Router, useValue: { navigate } },
        { provide: Location, useValue: { replaceState } },
        {
          provide: ProductReferenceService,
          useValue: {
            loadCategories,
            loadSuppliers,
            loadTrendKeywords,
            loadCategoryMarginMedian,
            clearCategoryMarginMedian,
            categories: signal([{ id: 10, label: '零食' }]),
            suppliers: signal([{ id: 20, name: '測試供應商' }]),
            trendKeywords: signal([{ id: 30, keyword: '抹茶' }]),
            categoryMarginMedian: signal(null),
            categoryMarginMedianError: signal(null),
            categoryError: signal(null),
            supplierError: signal(null),
            trendKeywordError: signal(null),
            loading: signal(false),
            error: signal(null),
          },
        },
        {
          provide: ProductEditorService,
          useValue: {
            load: loadProduct,
            save: saveProduct,
            clearError: vi.fn(),
            loading: signal(false),
            saving: signal(false),
            error: signal(null),
          },
        },
        {
          provide: ProductImageService,
          useValue: {
            load: loadImages,
            uploadFiles,
            reorder: reorderImages,
            delete: deleteImage,
            clear: clearImages,
            images: signal([]),
            loading: signal(false),
            error: signal(null),
          },
        },
        {
          provide: ProductSupplementService,
          useValue: {
            loadFestivals,
            loadAffinities,
            loadReviewSummary,
            saveAffinities,
            uploadReviewFile,
            clear: clearSupplements,
            festivals: signal([{ festivalCode: 'MID_AUTUMN', festivalName: '中秋節' }]),
            affinities: signal([]),
            reviewUploadResult: signal(null),
            reviewSummary: signal(null),
            loading: signal(false),
            error: signal(null),
            festivalError: signal(null),
            affinityError: signal(null),
            reviewSummaryError: signal(null),
          },
        },
        {
          provide: ProductService,
          useValue: { analyzeBatch },
        },
        { provide: AccessControlService, useValue: { hasRole: () => true } },
        { provide: DialogService, useValue: { Confirm: vi.fn(() => of(true)) } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the reference options for a new product', () => {
    expect(component).toBeTruthy();
    expect(loadCategories).toHaveBeenCalledOnce();
    expect(loadSuppliers).toHaveBeenCalledOnce();
    expect(loadTrendKeywords).toHaveBeenCalledOnce();
    expect(loadFestivals).toHaveBeenCalledOnce();
    expect(loadProduct).not.toHaveBeenCalled();
  });

  it('only offers save as draft for new or draft products', () => {
    expect(component.canSaveAsDraft()).toBe(true);

    component.productId.set(101);
    component.persistedStatus.set('DRAFT');
    expect(component.canSaveAsDraft()).toBe(true);

    component.persistedStatus.set('EVALUATING');
    expect(component.canSaveAsDraft()).toBe(false);
  });

  it('saves festival affinities and an attached review CSV after creating a product', () => {
    saveProduct
      .mockReturnValueOnce(
        of({ product: { id: 104, name: '節慶新品', status: 'DRAFT' }, warnings: [] }),
      )
      .mockReturnValueOnce(
        of({ product: { id: 104, name: '節慶新品', status: 'EVALUATING' }, warnings: [] }),
      );
    const reviewFile = new File(['content,rating\n很好吃,5'], 'reviews.csv', {
      type: 'text/csv',
    });
    component.form.patchValue({
      name: '節慶新品',
      categoryId: 10,
      trackType: 'A',
      cost: 80,
      suggestedPrice: 120,
    });
    component.addFestivalAffinity();
    component.festivalAffinities.at(0).setValue({
      festivalCode: 'MID_AUTUMN',
      affinity: 0.8,
    });
    component.reviewFile.set(reviewFile);

    component.save(false);

    expect(saveAffinities).toHaveBeenCalledWith(104, [
      { festivalCode: 'MID_AUTUMN', affinity: 0.8 },
    ]);
    expect(uploadReviewFile).toHaveBeenCalledWith(104, reviewFile);
    expect(saveProduct.mock.calls[0][1]).toEqual(expect.objectContaining({ saveAsDraft: true }));
    expect(saveProduct.mock.calls[1]).toEqual([
      104,
      expect.objectContaining({ saveAsDraft: false }),
    ]);
    expect(analyzeBatch).toHaveBeenCalledWith([104]);
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('saves a valid track A product and calculates its margin', () => {
    saveProduct
      .mockReturnValueOnce(
        of({ product: { id: 101, name: '抹茶餅乾', status: 'DRAFT' }, warnings: [] }),
      )
      .mockReturnValueOnce(
        of({ product: { id: 101, name: '抹茶餅乾', status: 'EVALUATING' }, warnings: [] }),
      );
    component.form.patchValue({
      name: '抹茶餅乾',
      categoryId: 10,
      supplierId: 20,
      trackType: 'A',
      cost: 90,
      suggestedPrice: 150,
      logisticsConditions: ['CHILLED'],
      keywordIds: [30],
    });

    expect(component.marginRate()).toBeCloseTo(0.4);
    component.save(false);

    expect(saveProduct).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        name: '抹茶餅乾',
        categoryId: 10,
        cost: 90,
        suggestedPrice: 150,
        trackType: 'A',
        saveAsDraft: true,
      }),
    );
    const sentRequest = saveProduct.mock.calls[0][1];
    expect(sentRequest.logisticsConditions).toEqual(['CHILLED']);
    expect(sentRequest.keywordIds).toEqual([30]);
    expect(JSON.parse(JSON.stringify(sentRequest))).toEqual(
      expect.objectContaining({
        logisticsConditions: ['CHILLED'],
        keywordIds: [30],
      }),
    );
    expect(saveProduct.mock.calls[1]).toEqual([
      101,
      expect.objectContaining({ saveAsDraft: false }),
    ]);
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('requires a keyword when submitting a track B product', () => {
    component.form.patchValue({
      name: '尋源新品',
      categoryId: 10,
      trackType: 'B',
      keywordIds: [],
    });

    component.save(false);

    expect(component.form.hasError('keywordRequired')).toBe(true);
    expect(saveProduct).not.toHaveBeenCalled();
  });

  it('explains that track B starts sourcing instead of scoring', () => {
    component.form.controls.trackType.setValue('B');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('儲存並開始尋源');
    expect(text).toContain('B 軌品項不會進入評分佇列');
    expect(text).toContain('也可先存為草稿');
  });

  it('keeps optional pricing, climate and festival inputs for track B', () => {
    saveProduct
      .mockReturnValueOnce(
        of({ product: { id: 103, name: '尋源新品', status: 'DRAFT' }, warnings: [] }),
      )
      .mockReturnValueOnce(
        of({ product: { id: 103, name: '尋源新品', status: 'EVALUATING' }, warnings: [] }),
      );
    component.form.patchValue({
      name: '尋源新品',
      categoryId: 10,
      trackType: 'B',
      supplierId: 20,
      cost: 90,
      suggestedPrice: 150,
      moq: 10,
      shelfLifeDays: 30,
      logisticsConditions: ['CHILLED'],
      idealTempMin: 2,
      idealTempMax: 8,
      season: 'SUMMER',
      keywordIds: [30],
    });
    component.addFestivalAffinity();
    component.festivalAffinities.at(0).setValue({
      festivalCode: 'MID_AUTUMN',
      affinity: 0.7,
    });

    component.save(false);

    expect(saveProduct).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        trackType: 'B',
        supplierId: undefined,
        cost: 90,
        suggestedPrice: 150,
        moq: undefined,
        shelfLifeDays: undefined,
        logisticsConditions: undefined,
        idealTempMin: 2,
        idealTempMax: 8,
        season: undefined,
        keywordIds: [30],
        saveAsDraft: true,
      }),
    );
    expect(saveAffinities).toHaveBeenCalledWith(103, [
      { festivalCode: 'MID_AUTUMN', affinity: 0.7 },
    ]);
    expect(saveProduct.mock.calls[1]).toEqual([
      103,
      expect.objectContaining({ saveAsDraft: false, cost: 90, suggestedPrice: 150 }),
    ]);
    expect(component.form.controls.cost.enabled).toBe(true);
    expect(component.form.controls.suggestedPrice.enabled).toBe(true);
  });

  it('keeps a new product as draft when supplemental data fails', () => {
    saveProduct.mockReturnValue(
      of({ product: { id: 105, name: '待補件新品', status: 'DRAFT' }, warnings: [] }),
    );
    saveAffinities.mockReturnValue(throwError(() => new Error('節慶服務暫時無法使用')));
    component.form.patchValue({
      name: '待補件新品',
      categoryId: 10,
      trackType: 'A',
      cost: 80,
      suggestedPrice: 120,
    });

    component.save(false);

    expect(saveProduct).toHaveBeenCalledOnce();
    expect(saveProduct).toHaveBeenCalledWith(null, expect.objectContaining({ saveAsDraft: true }));
    expect(analyzeBatch).not.toHaveBeenCalled();
    expect(component.persistedStatus()).toBe('DRAFT');
    expect(component.supplementFailureRetainedAsDraft()).toBe(true);
    expect(component.supplementalSaveErrors()).toEqual(['節慶關聯度：節慶服務暫時無法使用']);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not report an activated product as draft when only analysis scheduling fails', () => {
    saveProduct
      .mockReturnValueOnce(
        of({ product: { id: 107, name: '待評分新品', status: 'DRAFT' }, warnings: [] }),
      )
      .mockReturnValueOnce(
        of({ product: { id: 107, name: '待評分新品', status: 'EVALUATING' }, warnings: [] }),
      );
    analyzeBatch.mockReturnValue(throwError(() => new Error('評分服務暫時無法使用')));
    component.form.patchValue({
      name: '待評分新品',
      categoryId: 10,
      trackType: 'A',
      cost: 80,
      suggestedPrice: 120,
    });

    component.save(false);

    expect(component.persistedStatus()).toBe('EVALUATING');
    expect(component.supplementFailureRetainedAsDraft()).toBe(false);
    expect(component.supplementalSaveErrors()).toEqual(['評分排程：評分服務暫時無法使用']);
  });

  it('accepts one review CSV dropped on the upload zone', () => {
    const file = new File(['content\n好吃'], 'reviews.csv', { type: 'text/csv' });
    const event = {
      preventDefault: vi.fn(),
      dataTransfer: { files: [file], dropEffect: 'none' },
    } as unknown as DragEvent;

    component.onReviewFileDropped(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(component.reviewFile()).toBe(file);
    expect(component.reviewDragActive()).toBe(false);
  });

  it('does not overwrite festival affinities when they were not loaded', () => {
    saveProduct.mockReturnValue(
      of({ product: { id: 106, name: '保留節慶資料', status: 'DRAFT' }, warnings: [] }),
    );
    component.affinitiesLoaded.set(false);
    component.form.patchValue({ name: '保留節慶資料', categoryId: 10, trackType: 'A' });

    component.save(true);

    expect(saveProduct).toHaveBeenCalledOnce();
    expect(saveAffinities).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('allows an incomplete product to be saved as a draft', () => {
    saveProduct.mockReturnValue(of({ product: { id: 102, name: '草稿品項' }, warnings: [] }));
    component.form.patchValue({ name: '草稿品項', categoryId: 10, trackType: 'A' });

    component.save(true);

    expect(saveProduct).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ saveAsDraft: true, cost: undefined, suggestedPrice: undefined }),
    );
  });

  it('blocks a price that is not greater than cost', () => {
    component.form.patchValue({
      name: '價格錯誤品項',
      categoryId: 10,
      cost: 100,
      suggestedPrice: 100,
    });

    component.save(false);

    expect(component.form.hasError('invalidPrice')).toBe(true);
    expect(saveProduct).not.toHaveBeenCalled();
  });
});
