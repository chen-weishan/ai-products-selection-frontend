import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ProductControllerService } from '../../api/api/productController.service';
import { ProductEditorService } from './product-editor.service';

describe('ProductEditorService', () => {
  const getById = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  let service: ProductEditorService;

  beforeEach(() => {
    getById.mockReset();
    create.mockReset();
    update.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ProductEditorService,
        { provide: ProductControllerService, useValue: { getById, create, update } },
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
    create.mockReturnValue(
      of({
        success: true,
        data: {
          product: { id: 101, name: '抹茶餅乾' },
          warnings: ['同類別已有相同名稱的品項，資料仍已儲存'],
        },
      }),
    );
    const request = { name: '抹茶餅乾', categoryId: 10 };

    const result = await firstValueFrom(service.save(null, request));

    expect(create).toHaveBeenCalledWith({ productCreateRequest: request });
    expect(result.product.id).toBe(101);
    expect(result.warnings).toHaveLength(1);
    expect(service.saving()).toBe(false);
  });

  it('updates an existing product', async () => {
    update.mockReturnValue(
      of({ success: true, data: { product: { id: 101, name: '更新品項' }, warnings: [] } }),
    );
    const request = { name: '更新品項', categoryId: 10 };

    await firstValueFrom(service.save(101, request));

    expect(update).toHaveBeenCalledWith({ id: 101, productUpdateRequest: request });
  });
});
