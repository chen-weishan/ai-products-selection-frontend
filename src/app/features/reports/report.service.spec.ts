import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { BASE_PATH } from '../../api';
import { environment } from '../../../environments/environment';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/reports`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BASE_PATH, useValue: environment.apiBaseUrl },
      ],
    });
    service = TestBed.inject(ReportService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a report job with filters', async () => {
    const result = firstValueFrom(service.generate({
      reportType: 'ACCURACY',
      format: 'PDF',
      params: { from: '2026-01-01', to: '2026-09-30', categoryId: 3 },
    }));
    const request = http.expectOne(`${baseUrl}/generate`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.params.categoryId).toBe(3);
    request.flush({ success: true, data: {
      id: 7, reportType: 'ACCURACY', format: 'PDF', params: {}, status: 'PENDING',
      requestedAt: '2026-10-01T00:00:00Z', downloadable: false,
    }});
    expect((await result).id).toBe(7);
  });

  it('lists and downloads reports', async () => {
    const list = firstValueFrom(service.list());
    const listRequest = http.expectOne(request => request.url === baseUrl);
    expect(listRequest.request.params.get('sort')).toBe('requestedAt,desc');
    listRequest.flush({ success: true, data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
    expect((await list).content).toEqual([]);

    const download = firstValueFrom(service.download(9));
    const downloadRequest = http.expectOne(`${baseUrl}/9/download`);
    expect(downloadRequest.request.responseType).toBe('blob');
    downloadRequest.flush(new Blob(['pdf']));
    expect((await download).body?.size).toBe(3);
  });

  it('loads named filter options', async () => {
    const options = firstValueFrom(service.filterOptions());
    const request = http.expectOne(`${baseUrl}/filter-options`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: {
      categories: [{ id: 2, label: '食品／餅乾' }],
      decisionMakers: [{ id: 7, displayName: '王小明', email: 'buyer@example.com' }],
      scorePeriods: ['2026W41', '2026W39'],
      calibrationQuarters: ['2026Q3'],
    }});

    expect((await options).categories[0].label).toBe('食品／餅乾');
    expect((await options).scorePeriods).toEqual(['2026W41', '2026W39']);
  });
});
