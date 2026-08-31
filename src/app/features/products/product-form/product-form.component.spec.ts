import { signal } from '@angular/core';
import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { DialogService } from '../../../services/dialog-service';
import { ProductEditorService } from '../product-editor.service';
import { ProductImageService } from '../product-image.service';
import { ProductReferenceService } from '../product-reference.service';
import { ProductSupplementService } from '../product-supplement.service';
import { ProductFormComponent } from './product-form.component';

describe('ProductFormComponent', () => {
  const loadReferences = vi.fn();
  const loadTrendKeywords = vi.fn();
  const loadProduct = vi.fn();
  const saveProduct = vi.fn();
  const loadImages = vi.fn();
  const uploadFiles = vi.fn();
  const reorderImages = vi.fn();
  const deleteImage = vi.fn();
  const clearImages = vi.fn();
  const loadFestivals = vi.fn();
  const loadAffinities = vi.fn();
  const saveAffinities = vi.fn();
  const uploadReviewFile = vi.fn();
  const clearSupplements = vi.fn();
  const navigate = vi.fn();
  const snackOpen = vi.fn();
  const replaceState = vi.fn();
  let component: ProductFormComponent;
  let fixture: ComponentFixture<ProductFormComponent>;

  beforeEach(async () => {
    [
      loadReferences,
      loadTrendKeywords,
      loadProduct,
      saveProduct,
      loadImages,
      uploadFiles,
      reorderImages,
      deleteImage,
      clearImages,
      loadFestivals,
      loadAffinities,
      saveAffinities,
      uploadReviewFile,
      clearSupplements,
      navigate,
      snackOpen,
      replaceState,
    ].forEach((mock) => mock.mockReset());
    loadReferences.mockReturnValue(of(undefined));
    loadTrendKeywords.mockReturnValue(of(undefined));
    loadImages.mockReturnValue(of([]));
    uploadFiles.mockReturnValue(of([]));
    reorderImages.mockReturnValue(of([]));
    deleteImage.mockReturnValue(of([]));
    loadFestivals.mockReturnValue(of([]));
    loadAffinities.mockReturnValue(of([]));
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
            load: loadReferences,
            loadTrendKeywords,
            categories: signal([{ id: 10, label: '零食' }]),
            suppliers: signal([{ id: 20, name: '測試供應商' }]),
            trendKeywords: signal([{ id: 30, keyword: '抹茶' }]),
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
            saveAffinities,
            uploadReviewFile,
            clear: clearSupplements,
            festivals: signal([{ festivalCode: 'MID_AUTUMN', festivalName: '中秋節' }]),
            affinities: signal([]),
            reviewUploadResult: signal(null),
            loading: signal(false),
            error: signal(null),
          },
        },
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
    expect(loadReferences).toHaveBeenCalledOnce();
    expect(loadTrendKeywords).toHaveBeenCalledOnce();
    expect(loadFestivals).toHaveBeenCalledOnce();
    expect(loadProduct).not.toHaveBeenCalled();
  });

  it('saves festival affinities and an attached review CSV after creating a product', () => {
    saveProduct.mockReturnValue(of({ product: { id: 104, name: '節慶新品' }, warnings: [] }));
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
    expect(navigate).toHaveBeenCalledWith(['/products']);
  });

  it('saves a valid track A product and calculates its margin', () => {
    saveProduct.mockReturnValue(of({ product: { id: 101, name: '抹茶餅乾' }, warnings: [] }));
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
        saveAsDraft: false,
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

  it('omits track A-only fields when saving a track B product', () => {
    saveProduct.mockReturnValue(of({ product: { id: 103, name: '尋源新品' }, warnings: [] }));
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

    component.save(false);

    expect(saveProduct).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        trackType: 'B',
        supplierId: undefined,
        cost: undefined,
        suggestedPrice: undefined,
        moq: undefined,
        shelfLifeDays: undefined,
        logisticsConditions: undefined,
        idealTempMin: undefined,
        idealTempMax: undefined,
        season: undefined,
        keywordIds: [30],
      }),
    );
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
