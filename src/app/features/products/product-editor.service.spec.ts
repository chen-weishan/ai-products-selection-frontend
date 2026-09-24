import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ProductControllerService } from '../../api/api/productController.service';
import { ProductEditorService } from './product-editor.service';

describe('ProductEditorService', () => {
  const getById = vi.fn();
  const createProduct = vi.fn();
  const updateProduct = vi.fn();
  let service: ProductEditorService;

  beforeEach(() => {
    getById.mockReset();
    createProduct.mockReset();
    updateProduct.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ProductEditorService,
        { provide: ProductControllerService, useValue: { getById, createProduct, updateProduct } },
      ],
    });
    service = TestBed.inject(ProductEditorService);
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
        },
      }),
    );
    const request = {
      name: '抹茶餅乾',
      categoryId: 10,
      logisticsConditions: ['NORMAL' as const],
      keywordIds: [30],
    };

    const result = await firstValueFrom(service.save(null, request));

    expect(createProduct).toHaveBeenCalledWith({ productCreateRequest: request });
    expect(JSON.parse(JSON.stringify(createProduct.mock.calls[0][0].productCreateRequest))).toEqual(
      expect.objectContaining({ logisticsConditions: ['NORMAL'], keywordIds: [30] }),
    );
    expect(result.product.id).toBe(101);
    expect(result.warnings).toHaveLength(1);
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
