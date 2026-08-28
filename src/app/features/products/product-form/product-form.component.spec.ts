import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { DialogService } from '../../../services/dialog-service';
import { ProductEditorService } from '../product-editor.service';
import { ProductImageService } from '../product-image.service';
import { ProductReferenceService } from '../product-reference.service';
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
  const navigate = vi.fn();
  const snackOpen = vi.fn();
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
      navigate,
      snackOpen,
    ].forEach((mock) => mock.mockReset());
    loadReferences.mockReturnValue(of(undefined));
    loadTrendKeywords.mockReturnValue(of(undefined));
    loadImages.mockReturnValue(of([]));
    uploadFiles.mockReturnValue(of([]));
    reorderImages.mockReturnValue(of([]));
    deleteImage.mockReturnValue(of([]));
    navigate.mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [ProductFormComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
        { provide: Router, useValue: { navigate } },
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
    expect(loadProduct).not.toHaveBeenCalled();
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
