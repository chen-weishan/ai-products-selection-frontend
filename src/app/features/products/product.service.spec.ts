import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProductControllerService } from '../../api/api/productController.service';
import { ProductService } from './product.service';

describe('ProductService', () => {
  const search = vi.fn();
  const analyzeBatch = vi.fn();
  const queueScoreBatch = vi.fn();
  const assignCategory = vi.fn();
  const disableBatch = vi.fn();
  const deleteProduct = vi.fn();
  const changeStatus = vi.fn();
  const getTaskStatus = vi.fn();
  let service: ProductService;

  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    search.mockReset();
    analyzeBatch.mockReset();
    queueScoreBatch.mockReset();
    assignCategory.mockReset();
    disableBatch.mockReset();
    deleteProduct.mockReset();
    changeStatus.mockReset();
    getTaskStatus.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ProductService,
        {
          provide: ProductControllerService,
          useValue: {
            search,
            analyzeBatch,
            queueScoreBatch,
            assignCategory,
            disableBatch,
            _delete: deleteProduct,
            changeStatus,
          },
        },
        { provide: HttpClient, useValue: { get: getTaskStatus } },
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
      productBatchAnalyzeRequest: { productIds: [101, 102] },
    });
    expect(service.batchMessage()).toBe('已將 2 筆品項加入評分佇列');
    expect(service.batchLoading()).toBe(false);
  });

  it('uses the dedicated score queue endpoint and reports skipped products', async () => {
    queueScoreBatch.mockReturnValue(
      of({
        success: true,
        data: {
          taskId: 21,
          status: 'PENDING',
          requestedCount: 3,
          queuedCount: 1,
          warnings: ['品項已在評分佇列中，已略過：[102, 103]'],
        },
      }),
    );

    await firstValueFrom(service.queueScoreBatch([101, 102, 103]));

    expect(queueScoreBatch).toHaveBeenCalledWith({
      productBatchQueueScoreRequest: { productIds: [101, 102, 103] },
    });
    expect(service.batchMessage()).toContain('已將 1 筆品項加入評分佇列');
    expect(service.batchMessage()).toContain('已略過');
  });

  it('refreshes the current list when an analysis task succeeds', async () => {
    vi.useFakeTimers();
    analyzeBatch.mockReturnValue(
      of({ success: true, data: { taskId: 12, status: 'PENDING', queuedCount: 1 } }),
    );
    getTaskStatus.mockReturnValue(
      of({
        success: true,
        data: {
          taskId: 12,
          status: 'SUCCEEDED',
          totalCount: 1,
          successCount: 1,
          failCount: 0,
          progressPercent: 100,
        },
      }),
    );
    search.mockReturnValue(
      of({
        success: true,
        data: { content: [{ id: 101, latestScore: 82 }], page: 0, size: 20 },
      }),
    );

    await firstValueFrom(service.analyzeBatch([101]));
    await vi.advanceTimersByTimeAsync(2_000);

    expect(getTaskStatus).toHaveBeenCalledWith('http://localhost:8080/api/v1/ai/tasks/12');
    expect(search).toHaveBeenCalled();
    expect(service.products()).toEqual([{ id: 101, latestScore: 82 }]);
    expect(service.analysisMessage()).toBe('評分完成：1 筆成功，清單已自動更新');
    expect(service.analysisPolling()).toBe(false);
  });

  it('reports an analysis task failure and still refreshes the list', async () => {
    vi.useFakeTimers();
    analyzeBatch.mockReturnValue(
      of({ success: true, data: { taskId: 13, status: 'PENDING', queuedCount: 1 } }),
    );
    getTaskStatus.mockReturnValue(
      of({
        success: true,
        data: {
          taskId: 13,
          status: 'FAILED',
          totalCount: 1,
          successCount: 0,
          failCount: 1,
          progressPercent: 100,
        },
      }),
    );
    search.mockReturnValue(of({ success: true, data: { content: [], page: 0, size: 20 } }));

    await firstValueFrom(service.analyzeBatch([101]));
    await vi.advanceTimersByTimeAsync(2_000);

    expect(service.analysisError()).toBe('評分任務 #13 執行失敗：0 筆成功、1 筆失敗');
    expect(search).toHaveBeenCalled();
    expect(service.analysisPolling()).toBe(false);
  });

  it('stops polling and reports when an analysis task exceeds 30 seconds', async () => {
    vi.useFakeTimers();
    analyzeBatch.mockReturnValue(
      of({ success: true, data: { taskId: 14, status: 'PENDING', queuedCount: 1 } }),
    );
    getTaskStatus.mockReturnValue(
      of({
        success: true,
        data: {
          taskId: 14,
          status: 'RUNNING',
          totalCount: 1,
          successCount: 0,
          failCount: 0,
          progressPercent: 0,
        },
      }),
    );

    await firstValueFrom(service.analyzeBatch([101]));
    await vi.advanceTimersByTimeAsync(30_000);

    expect(service.analysisError()).toContain('等待超過 30 秒');
    expect(service.analysisPolling()).toBe(false);
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
        productIds: [101, 102],
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

  it('serializes batch disable product IDs as a JSON array', async () => {
    disableBatch.mockReturnValue(
      of({ success: true, data: { disabledCount: 2, productIds: [101, 102] } }),
    );

    await firstValueFrom(service.disableBatch([101, 102]));

    const request = disableBatch.mock.calls[0][0].productBatchDisableRequest;
    expect(request.productIds).toEqual([101, 102]);
    expect(JSON.parse(JSON.stringify(request))).toEqual({ productIds: [101, 102] });
  });

  it('deletes one product through the generated API client', async () => {
    deleteProduct.mockReturnValue(of({ success: true, data: null }));

    await firstValueFrom(service.deleteProduct(101));

    expect(deleteProduct).toHaveBeenCalledWith({ id: 101 });
    expect(service.batchMessage()).toBe('品項已刪除');
  });

  it('changes product status with an optional rejection reason', async () => {
    changeStatus.mockReturnValue(
      of({
        success: true,
        data: { productId: 101, previousStatus: 'EVALUATING', status: 'REJECTED' },
      }),
    );

    await firstValueFrom(
      service.changeStatus(101, { targetStatus: 'REJECTED', rejectReason: '毛利不足，不予採納' }),
    );

    expect(changeStatus).toHaveBeenCalledWith({
      id: 101,
      productStatusUpdateRequest: {
        targetStatus: 'REJECTED',
        rejectReason: '毛利不足，不予採納',
      },
    });
    expect(service.batchMessage()).toBe('品項狀態已更新');
  });
});
