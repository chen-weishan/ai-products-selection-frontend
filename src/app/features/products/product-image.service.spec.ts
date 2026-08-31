import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductImageService, ProductImageUploadError } from './product-image.service';

describe('ProductImageService', () => {
  let service: ProductImageService;
  let httpTesting: HttpTestingController;
  const imagesUrl = `${environment.apiBaseUrl}/products/101/images`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductImageService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductImageService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads image metadata', async () => {
    const promise = firstValueFrom(service.load(101));

    httpTesting.expectOne(imagesUrl).flush({ success: true, data: [] });

    await expect(promise).resolves.toEqual([]);
    expect(service.images()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('uploads a multipart image and refreshes the list', async () => {
    const file = new File(['image'], 'product.png', { type: 'image/png' });
    const promise = firstValueFrom(service.uploadFiles(101, [file]));

    const uploadRequest = httpTesting.expectOne(imagesUrl);
    expect(uploadRequest.request.method).toBe('POST');
    expect(uploadRequest.request.body).toBeInstanceOf(FormData);
    uploadRequest.flush({ success: true, data: { id: 1, productId: 101 } });
    httpTesting.expectOne(imagesUrl).flush({ success: true, data: [] });

    await expect(promise).resolves.toEqual([]);
  });

  it('reports how many files succeeded before a later upload failed', async () => {
    const first = new File(['first'], 'first.png', { type: 'image/png' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });
    const promise = firstValueFrom(service.uploadFiles(101, [first, second]));

    httpTesting.expectOne(imagesUrl).flush({ success: true, data: { id: 1, productId: 101 } });
    httpTesting
      .expectOne(imagesUrl)
      .flush({ error: { message: '第二張圖片失敗' } }, { status: 400, statusText: 'Bad Request' });

    await expect(promise).rejects.toMatchObject({ uploadedCount: 1 });
    expect(service.error()).toBe('第二張圖片失敗');
  });

  it('sends a new image order and refreshes the list', async () => {
    const promise = firstValueFrom(service.reorder(101, [2, 1]));

    const reorderRequest = httpTesting.expectOne(`${imagesUrl}/order`);
    expect(reorderRequest.request.method).toBe('PATCH');
    expect(reorderRequest.request.body).toEqual({ imageIds: [2, 1] });
    reorderRequest.flush({ success: true, data: [] });
    httpTesting.expectOne(imagesUrl).flush({ success: true, data: [] });

    await expect(promise).resolves.toEqual([]);
  });
});
