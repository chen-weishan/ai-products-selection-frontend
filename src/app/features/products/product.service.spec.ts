import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ProductControllerService } from '../../api/api/productController.service';
import { ProductService } from './product.service';

describe('ProductService', () => {
  const search = vi.fn();
  let service: ProductService;

  beforeEach(() => {
    search.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ProductService,
        {
          provide: ProductControllerService,
          useValue: { search },
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
      pageable: {
        page: 1,
        size: 50,
        sort: ['latestScore,desc'],
      },
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
});
