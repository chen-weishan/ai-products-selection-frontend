import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MasterDataService } from './master-data.service';
import { environment } from '../../../environments/environment';

describe('MasterDataService', () => {
  let service: MasterDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MasterDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a category through the reference-data endpoint', () => {
    service.createCategory({ name: '食品', parentId: null, sortOrder: 0 }).subscribe((result) => {
      expect(result.name).toBe('食品');
    });

    const request = http.expectOne(`${environment.apiBaseUrl}/categories`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: '食品', parentId: null, sortOrder: 0 });
    request.flush({
      success: true,
      data: { id: 1, name: '食品', parentId: null, parentName: null, sortOrder: 0 },
    });
  });

  it('updates a supplier through its resource id', () => {
    service.updateSupplier(8, {
      name: '晨曦貿易',
      contact: null,
      phone: null,
      note: null,
    }).subscribe((result) => expect(result.id).toBe(8));

    const request = http.expectOne(`${environment.apiBaseUrl}/suppliers/8`);
    expect(request.request.method).toBe('PUT');
    request.flush({
      success: true,
      data: { id: 8, name: '晨曦貿易', contact: null, phone: null, note: null },
    });
  });

  it('deletes a category through its resource id', () => {
    service.deleteCategory(7).subscribe((result) => expect(result).toBeUndefined());

    const request = http.expectOne(`${environment.apiBaseUrl}/categories/7`);
    expect(request.request.method).toBe('DELETE');
    request.flush({ success: true, data: null });
  });

  it('surfaces a resource-in-use message when supplier deletion is rejected', () => {
    let message = '';
    service.deleteSupplier(8).subscribe({ error: (error: Error) => message = error.message });

    const request = http.expectOne(`${environment.apiBaseUrl}/suppliers/8`);
    expect(request.request.method).toBe('DELETE');
    request.flush({
      success: false,
      error: { code: 'RESOURCE_IN_USE', message: '供應商仍被 2 筆品項使用，無法刪除' },
    }, { status: 409, statusText: 'Conflict' });
    expect(message).toBe('供應商仍被 2 筆品項使用，無法刪除');
  });
});
