import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import { ImportService } from './import.service';

describe('ImportService', () => {
  let service: ImportService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/imports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ImportService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ImportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads a multipart file with its data type', async () => {
    const file = new File(['a,b'], 'sales.csv', { type: 'text/csv' });
    const result = firstValueFrom(service.upload('SALES', file));
    const request = http.expectOne((candidate) =>
      candidate.url === `${baseUrl}/upload` && candidate.params.get('dataType') === 'SALES');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    request.flush({ success: true, data: { batchId: 1 } });
    await expect(result).resolves.toMatchObject({ batchId: 1 });
  });

  it('reloads pending upload metadata from its batch', async () => {
    const result = firstValueFrom(service.resumePending(12));
    const request = http.expectOne(`${baseUrl}/12/resume`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: {
      batchId: 12, dataType: 'SALES', headers: ['訂單日期', '品名'],
      mappingSuggestions: [],
    } });
    await expect(result).resolves.toMatchObject({ batchId: 12, headers: ['訂單日期', '品名'] });
  });

  it('sends the same mappings to preview, error download and confirm', async () => {
    const mappings = { 品名: 'productName', 評論內容: 'content' };
    const preview = firstValueFrom(service.preview(7, mappings));
    http.expectOne(`${baseUrl}/7/preview`).flush({ success: true, data: { batchId: 7 } });
    await preview;

    const errors = firstValueFrom(service.downloadPreviewErrors(7, mappings));
    const errorRequest = http.expectOne(`${baseUrl}/7/preview/errors/download`);
    expect(errorRequest.request.responseType).toBe('blob');
    expect(errorRequest.request.body).toEqual({ mappings });
    errorRequest.flush(new Blob(['errors']));
    await errors;

    const confirm = firstValueFrom(service.confirm(7, mappings));
    const confirmRequest = http.expectOne(`${baseUrl}/7/confirm`);
    expect(confirmRequest.request.body).toEqual({ mappings });
    confirmRequest.flush({ success: true, data: { batchId: 7 } });
    await confirm;
  });

  it('supports progress polling and final error download', async () => {
    const batch = firstValueFrom(service.batch(9));
    const batchRequest = http.expectOne(`${baseUrl}/9`);
    expect(batchRequest.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    batchRequest.flush({
      success: true,
      data: { batchId: 9, status: 'RUNNING', progressPercent: 40 },
    });
    await expect(batch).resolves.toMatchObject({ progressPercent: 40 });

    const errors = firstValueFrom(service.downloadErrors(9));
    const request = http.expectOne(`${baseUrl}/9/errors/download`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['errors']));
    await errors;
  });

  it('downloads the unprocessed tail and retries failed recalculations', async () => {
    const tail = firstValueFrom(service.downloadUnprocessed(9));
    const download = http.expectOne(`${baseUrl}/9/unprocessed/download`);
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['productName\n奶茶']));
    await tail;
    const retry = firstValueFrom(service.retryRecalculation(9));
    const request = http.expectOne(`${baseUrl}/9/recalculation/retry`);
    expect(request.request.method).toBe('POST');
    request.flush({ success: true, data: 2 });
    await expect(retry).resolves.toBe(2);
  });

  it('supports mapping template CRUD', async () => {
    const body = { name: '評論範本', dataType: 'REVIEW' as const, mappings: { 品名: 'productName' } };
    const create = firstValueFrom(service.createTemplate(body));
    http.expectOne(`${baseUrl}/mapping-templates`).flush({ success: true, data: { id: 3 } });
    await create;

    const update = firstValueFrom(service.updateTemplate(3, body));
    http.expectOne(`${baseUrl}/mapping-templates/3`).flush({ success: true, data: { id: 3 } });
    await update;

    const remove = firstValueFrom(service.deleteTemplate(3));
    http.expectOne(`${baseUrl}/mapping-templates/3`).flush({ success: true });
    await remove;
  });
});
