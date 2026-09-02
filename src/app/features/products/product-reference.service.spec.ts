import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProductReferenceControllerService } from '../../api/api/productReferenceController.service';
import { ProductReferenceService } from './product-reference.service';

describe('ProductReferenceService', () => {
  const getCategories = vi.fn();
  const getSuppliers = vi.fn();
  const getTrendKeywords = vi.fn();
  const getCategoryMarginMedian = vi.fn();
  let service: ProductReferenceService;

  beforeEach(() => {
    getCategories.mockReset();
    getSuppliers.mockReset();
    getTrendKeywords.mockReset();
    getCategoryMarginMedian.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ProductReferenceService,
        {
          provide: ProductReferenceControllerService,
          useValue: { getCategories, getSuppliers, getTrendKeywords, getCategoryMarginMedian },
        },
      ],
    });
    service = TestBed.inject(ProductReferenceService);
  });

  it('loads and flattens category and supplier options', async () => {
    getCategories.mockReturnValue(
      of({
        success: true,
        data: [
          {
            id: 10,
            name: '食品',
            children: [{ id: 11, name: '飲品', children: [] }],
          },
        ],
      }),
    );
    getSuppliers.mockReturnValue(of({ success: true, data: [{ id: 1, name: '測試供應商' }] }));

    await firstValueFrom(service.load());

    expect(service.categories()).toEqual([
      { id: 10, label: '食品' },
      { id: 11, label: '— 飲品' },
    ]);
    expect(service.suppliers()).toEqual([{ id: 1, name: '測試供應商' }]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('loads enabled trend keyword options', async () => {
    getTrendKeywords.mockReturnValue(
      of({ success: true, data: [{ id: 7, keyword: '抹茶', enabled: true }] }),
    );

    await firstValueFrom(service.loadTrendKeywords());

    expect(getTrendKeywords).toHaveBeenCalledWith({ enabled: true });
    expect(service.trendKeywords()).toEqual([{ id: 7, keyword: '抹茶', enabled: true }]);
  });

  it('keeps category options available when optional suppliers fail', async () => {
    getCategories.mockReturnValue(
      of({ success: true, data: [{ id: 10, name: '食品', children: [] }] }),
    );
    getSuppliers.mockReturnValue(throwError(() => new Error('供應商服務中斷')));

    await firstValueFrom(service.loadCategories());
    await expect(firstValueFrom(service.loadSuppliers())).rejects.toThrow('供應商服務中斷');

    expect(service.categories()).toEqual([{ id: 10, label: '食品' }]);
    expect(service.supplierError()).toBe('供應商服務中斷');
    expect(service.categoryError()).toBeNull();
  });
});
