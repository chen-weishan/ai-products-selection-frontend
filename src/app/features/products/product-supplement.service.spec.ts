import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProductSupplementService } from './product-supplement.service';

describe('ProductSupplementService', () => {
  let service: ProductSupplementService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductSupplementService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductSupplementService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads festival options', async () => {
    const promise = firstValueFrom(service.loadFestivals());
    httpTesting.expectOne(`${environment.apiBaseUrl}/festivals`).flush({
      success: true,
      data: [{ festivalCode: 'MID_AUTUMN', festivalName: '中秋節' }],
    });

    await expect(promise).resolves.toHaveLength(1);
    expect(service.festivals()[0].festivalName).toBe('中秋節');
  });

  it('replaces product festival affinities', async () => {
    const promise = firstValueFrom(
      service.saveAffinities(101, [{ festivalCode: 'MID_AUTUMN', affinity: 0.8 }]),
    );
    const request = httpTesting.expectOne(
      `${environment.apiBaseUrl}/products/101/festival-affinity`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      affinities: [{ festivalCode: 'MID_AUTUMN', affinity: 0.8 }],
    });
    request.flush({
      success: true,
      data: [{ festivalCode: 'MID_AUTUMN', festivalName: '中秋節', affinity: 0.8 }],
    });

    await expect(promise).resolves.toHaveLength(1);
  });

  it('uploads a review CSV as multipart form data', async () => {
    const file = new File(['content\n好吃'], 'reviews.csv', { type: 'text/csv' });
    const promise = firstValueFrom(service.uploadReviewFile(101, file));
    const request = httpTesting.expectOne(`${environment.apiBaseUrl}/products/101/comments-file`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    request.flush({
      success: true,
      data: {
        fileName: 'reviews.csv',
        acceptedRows: 1,
        insertedCount: 1,
        duplicateCount: 0,
        totalReviewCount: 1,
        lowConfidence: true,
      },
    });

    await expect(promise).resolves.toMatchObject({ insertedCount: 1 });
  });
});
