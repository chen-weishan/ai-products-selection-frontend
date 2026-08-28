import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProductControllerService } from '../../api/api/productController.service';
import { ProductService } from './product.service';

describe('ProductService', () => {
  const search = vi.fn();
  const analyzeBatch = vi.fn();
  const assignCategory = vi.fn();
  const disableBatch = vi.fn();
  let service: ProductService;

  beforeEach(() => {
    search.mockReset();
    analyzeBatch.mockReset();
    assignCategory.mockReset();
    disableBatch.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ProductService,
        {
          provide: ProductControllerService,
          useValue: { search, analyzeBatch, assignCategory, disableBatch },
        },
      ],
    });
    service = TestBed.inject(ProductService);
  });

  it('loads products with the requested filters and pagination', async () => {
    search.mockReturnValue(
      of({
        success: true,
        data: {
          content: [{ id: 101, name: '抹茶餅乾', trackType: 'A' }],
          page: 1,
          size: 50,
          totalElements: 51,
          totalPages: 2,
        },
      }),
    );

    await firstValueFrom(service.load({ keyword: '抹茶', page: 1, size: 50 }));

    expect(search).toHaveBeenCalledWith({
      keyword: '抹茶',
      page: 1,
      size: 50,
      sort: ['latestScore,desc'],
    });
    expect(service.products()).toEqual([{ id: 101, name: '抹茶餅乾', trackType: 'A' }]);
    expect(service.totalElements()).toBe(51);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('exposes API errors and stops loading', async () => {
    search.mockReturnValue(throwError(() => new Error('後端連線失敗')));

    await expect(firstValueFrom(service.load())).rejects.toThrow('後端連線失敗');

    expect(service.error()).toBe('後端連線失敗');
    expect(service.loading()).toBe(false);
  });

  it('adds selected products to the analysis queue', async () => {
    analyzeBatch.mockReturnValue(
      of({ success: true, data: { taskId: 12, status: 'PENDING', queuedCount: 2 } }),
    );

    await firstValueFrom(service.analyzeBatch([101, 102]));

    expect(analyzeBatch).toHaveBeenCalledWith({
      productBatchAnalyzeRequest: { productIds: new Set([101, 102]) },
    });
    expect(service.batchMessage()).toBe('已將 2 筆品項加入評分佇列');
    expect(service.batchLoading()).toBe(false);
  });

  it('assigns a category to selected products', async () => {
    assignCategory.mockReturnValue(
      of({
        success: true,
        data: { categoryId: 10, categoryName: '零食', updatedCount: 2 },
      }),
    );

    await firstValueFrom(service.assignCategory([101, 102], 10));

    expect(assignCategory).toHaveBeenCalledWith({
      productBatchCategoryRequest: {
        productIds: new Set([101, 102]),
        categoryId: 10,
      },
    });
    expect(service.batchMessage()).toBe('已將 2 筆品項指定為「零食」');
  });

  it('exposes batch API errors', async () => {
    disableBatch.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: { error: { message: '沒有批次停用權限' } },
          }),
      ),
    );

    await expect(firstValueFrom(service.disableBatch([101]))).rejects.toBeInstanceOf(
      HttpErrorResponse,
    );

    expect(service.batchError()).toBe('沒有批次停用權限');
    expect(service.batchLoading()).toBe(false);
  });
});
