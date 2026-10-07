import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { ProductControllerService } from '../../api/api/productController.service';
import { ProductEditorService } from './product-editor.service';

describe('ProductEditorService', () => {
  const getById = vi.fn();
  const createProduct = vi.fn();
  const updateProduct = vi.fn();
  const put = vi.fn();
  const post = vi.fn();
  let service: ProductEditorService;

  beforeEach(() => {
    getById.mockReset();
    createProduct.mockReset();
    updateProduct.mockReset();
    put.mockReset();
    post.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ProductEditorService,
        { provide: HttpClient, useValue: { put, post } },
        { provide: ProductControllerService, useValue: { getById, createProduct, updateProduct } },
      ],
    });
    service = TestBed.inject(ProductEditorService);
  });

  it('defers analysis when updating a formal product as part of a combined save', async () => {
    put.mockReturnValue(
      of({ success: true, data: { product: { id: 101, name: '更新品項' }, warnings: [] } }),
    );
    const request = { name: '更新品項', categoryId: 10 };

    await firstValueFrom(service.save(101, request, { deferAnalysis: true }));

    expect(put).toHaveBeenCalledWith(
      expect.stringContaining('/products/101'),
      request,
      { params: { deferAnalysis: true } },
    );
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it('finalizes analysis after all scoring inputs are stored', async () => {
    post.mockReturnValue(
      of({ success: true, data: { taskId: 701, taskStatus: 'PENDING', queued: true } }),
    );

    const result = await firstValueFrom(service.finalizeAnalysis(101));

    expect(post).toHaveBeenCalledWith(
      expect.stringContaining('/products/101/analysis/finalize'),
      null,
    );
    expect(result.taskId).toBe(701);
  });

  it('loads an existing product', async () => {
    getById.mockReturnValue(of({ success: true, data: { id: 101, name: '抹茶餅乾' } }));

    const product = await firstValueFrom(service.load(101));

    expect(getById).toHaveBeenCalledWith({ id: 101 });
    expect(product.name).toBe('抹茶餅乾');
    expect(service.loading()).toBe(false);
  });

  it('creates a product and preserves backend warnings', async () => {
    createProduct.mockReturnValue(
      of({
        success: true,
        data: {
          product: { id: 101, name: '抹茶餅乾' },
          warnings: ['同類別已有相同名稱的品項，資料仍已儲存'],
          taskId: 501,
          taskStatus: 'PENDING',
        },
      }),
    );
    const request = {
      name: '抹茶餅乾',
      categoryId: 10,
      logisticsConditions: ['NORMAL'] as unknown as Set<'NORMAL'>,
      keywordIds: [30] as unknown as Set<number>,
    };

    const result = await firstValueFrom(service.save(null, request));

    expect(createProduct).toHaveBeenCalledWith({ productCreateRequest: request });
    expect(JSON.parse(JSON.stringify(createProduct.mock.calls[0][0].productCreateRequest))).toEqual(
      expect.objectContaining({ logisticsConditions: ['NORMAL'], keywordIds: [30] }),
    );
    expect(result.product.id).toBe(101);
    expect(result.warnings).toHaveLength(1);
    expect(result.taskId).toBe(501);
    expect(result.taskStatus).toBe('PENDING');
    expect(service.saving()).toBe(false);
  });

  it('updates an existing product', async () => {
    updateProduct.mockReturnValue(
      of({ success: true, data: { product: { id: 101, name: '更新品項' }, warnings: [] } }),
    );
    const request = { name: '更新品項', categoryId: 10 };

    await firstValueFrom(service.save(101, request));

    expect(updateProduct).toHaveBeenCalledWith({ id: 101, productUpdateRequest: request });
  });
});
