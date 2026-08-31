import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { DialogService } from '../../../services/dialog-service';
import { AccessControlService } from '../../../core/auth/access-control.service';
import { ProductReferenceService } from '../product-reference.service';
import { ProductService } from '../product.service';
import { ProductListComponent } from './product-list.component';

describe('ProductListComponent', () => {
  const load = vi.fn();
  const loadReferences = vi.fn();
  const navigate = vi.fn();
  const analyzeBatch = vi.fn();
  const assignCategory = vi.fn();
  const disableBatch = vi.fn();
  const deleteProduct = vi.fn();
  const changeStatus = vi.fn();
  const confirm = vi.fn();
  const changeProductStatus = vi.fn();
  const products = signal<any[]>([]);
  let queryParams: BehaviorSubject<ParamMap>;
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;

  beforeEach(async () => {
    load.mockReset();
    loadReferences.mockReset();
    navigate.mockReset();
    analyzeBatch.mockReset();
    assignCategory.mockReset();
    disableBatch.mockReset();
    deleteProduct.mockReset();
    changeStatus.mockReset();
    confirm.mockReset();
    changeProductStatus.mockReset();
    products.set([]);
    load.mockReturnValue(of({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }));
    loadReferences.mockReturnValue(of(undefined));
    analyzeBatch.mockReturnValue(of({ queuedCount: 2 }));
    assignCategory.mockReturnValue(of({ updatedCount: 2 }));
    disableBatch.mockReturnValue(of({ disabledCount: 2 }));
    deleteProduct.mockReturnValue(of(undefined));
    changeStatus.mockReturnValue(of({ status: 'ADOPTED' }));
    confirm.mockReturnValue(of(true));
    changeProductStatus.mockReturnValue(of({ targetStatus: 'ADOPTED' }));
    navigate.mockResolvedValue(true);
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [ProductListComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParams.asObservable() },
        },
        {
          provide: Router,
          useValue: { navigate },
        },
        {
          provide: DialogService,
          useValue: { Confirm: confirm, ChangeProductStatus: changeProductStatus },
        },
        {
          provide: AccessControlService,
          useValue: {
            hasRole: (roles: string | string[]) =>
              ([] as string[]).concat(roles).includes('BUYER_LEAD'),
          },
        },
        {
          provide: ProductReferenceService,
          useValue: {
            load: loadReferences,
            categories: signal([]),
            suppliers: signal([]),
            loading: signal(false),
            error: signal(null),
          },
        },
        {
          provide: ProductService,
          useValue: {
            load,
            products,
            page: signal(0),
            size: signal(20),
            totalElements: signal(0),
            totalPages: signal(0),
            loading: signal(false),
            error: signal(null),
            batchLoading: signal(false),
            batchMessage: signal(null),
            batchError: signal(null),
            analyzeBatch,
            assignCategory,
            disableBatch,
            deleteProduct,
            changeStatus,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load default references and products', () => {
    expect(component).toBeTruthy();
    expect(loadReferences).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith({
      page: 0,
      size: 20,
      sort: ['latestScore,desc'],
    });
  });

  it('restores filters, paging and sorting from the URL', () => {
    load.mockClear();

    queryParams.next(
      convertToParamMap({
        keyword: '抹茶',
        categoryId: '10',
        trackType: 'A',
        status: 'EVALUATING',
        minScore: '70',
        hasRisk: 'true',
        page: '1',
        size: '50',
        sort: 'name,asc',
      }),
    );

    expect(load).toHaveBeenCalledWith({
      keyword: '抹茶',
      categoryId: 10,
      trackType: 'A',
      status: 'EVALUATING',
      minScore: 70,
      hasRisk: true,
      page: 1,
      size: 50,
      sort: ['name,asc'],
    });
    expect(component.filterForm.controls.keyword.value).toBe('抹茶');
  });

  it('disables and removes score filters for track B URLs', () => {
    load.mockClear();

    queryParams.next(convertToParamMap({ trackType: 'B', minScore: '70', maxScore: '90' }));

    expect(load).toHaveBeenCalledWith({
      trackType: 'B',
      page: 0,
      size: 20,
      sort: ['timeGapDays,asc'],
    });
    expect(component.filterForm.controls.minScore.disabled).toBe(true);
    expect(component.filterForm.controls.maxScore.disabled).toBe(true);
    expect(component.filterForm.controls.minScore.value).toBeNull();
    expect(component.filterForm.controls.maxScore.value).toBeNull();
  });

  it('writes paging changes back to the URL', () => {
    component.onPage({
      pageIndex: 1,
      previousPageIndex: 0,
      pageSize: 50,
      length: 80,
    });

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({
          page: 1,
          size: 50,
          sort: ['latestScore,desc'],
        }),
        replaceUrl: false,
      }),
    );
  });

  it('adds all selected products to the analysis queue', () => {
    products.set([
      { id: 101, name: 'A', trackType: 'A', status: 'EVALUATING' },
      { id: 102, name: 'B', trackType: 'A', status: 'WATCHING' },
    ]);
    component.selection.select(101, 102);

    component.analyzeSelected();

    expect(analyzeBatch).toHaveBeenCalledWith([101, 102]);
    expect(component.selection.isEmpty()).toBe(true);
  });

  it('skips track B and draft products when requesting analysis', () => {
    products.set([
      { id: 101, name: '可評分', trackType: 'A', status: 'EVALUATING' },
      { id: 102, name: 'B 軌', trackType: 'B', status: 'EVALUATING' },
      { id: 103, name: '草稿', trackType: 'A', status: 'DRAFT' },
    ]);
    component.selection.select(101, 102, 103);

    component.analyzeSelected();

    expect(analyzeBatch).toHaveBeenCalledWith([101]);
    expect(component.selectionNotice()).toContain('略過 2 筆');
  });

  it('assigns a category to selected products before reloading', () => {
    load.mockClear();
    component.selection.select(101, 102);
    component.batchCategoryId.setValue(10);

    component.assignSelectedCategory();

    expect(assignCategory).toHaveBeenCalledWith([101, 102], 10);
    expect(load).toHaveBeenCalledWith(component.criteria());
    expect(component.batchCategoryId.value).toBeNull();
    expect(component.selection.isEmpty()).toBe(true);
  });

  it('confirms and disables selected products before reloading', () => {
    load.mockClear();
    component.selection.select(101, 102);

    component.disableSelected();

    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: '批次停用品項', isDanger: true }),
    );
    expect(disableBatch).toHaveBeenCalledWith([101, 102]);
    expect(load).toHaveBeenCalledWith(component.criteria());
    expect(component.selection.isEmpty()).toBe(true);
  });
});
