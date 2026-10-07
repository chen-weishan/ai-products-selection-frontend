import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SourcingQueueService } from './sourcing-queue.service';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';

describe('SourcingQueueService', () => {
  let service: SourcingQueueService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SourcingQueueService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads one server-side queue page with filter parameters', () => {
    let result: any;
    service.getQueue('ACTIVE', 1, 20).subscribe((value) => result = value);

    const request = http.expectOne((candidate) =>
      candidate.url === '/api/v1/sourcing/queue'
      && candidate.params.get('status') === 'ACTIVE'
      && candidate.params.get('page') === '1'
      && candidate.params.get('size') === '20'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      success: true,
      data: {
        content: [], page: 1, size: 20, totalElements: 0, totalPages: 0,
        summary: { activeCount: 0, rejectedCount: 0, promotedCount: 0 },
      },
    });

    expect(result.page).toBe(1);
  });

  it('can refresh an action result without showing the global loading overlay', () => {
    service.getQueue('ALL', 0, 10, true).subscribe();

    const request = http.expectOne('/api/v1/sourcing/queue?status=ALL&page=0&size=10');
    expect(request.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    request.flush({
      success: true,
      data: {
        content: [], page: 0, size: 10, totalElements: 0, totalPages: 0,
        summary: { activeCount: 0, rejectedCount: 0, promotedCount: 0 },
      },
    });
  });

  it('reuses a previously loaded page without sending another request', () => {
    const values: any[] = [];
    service.getQueue('ALL', 0, 10).subscribe((value) => values.push(value));
    const request = http.expectOne('/api/v1/sourcing/queue?status=ALL&page=0&size=10');
    request.flush({
      success: true,
      data: {
        content: [], page: 0, size: 10, totalElements: 0, totalPages: 0,
        summary: { activeCount: 0, rejectedCount: 0, promotedCount: 0 },
      },
    });

    service.getQueue('ALL', 0, 10).subscribe((value) => values.push(value));

    http.expectNone('/api/v1/sourcing/queue?status=ALL&page=0&size=10');
    expect(values).toHaveLength(2);
  });

  it('fetches the page again after the cache is invalidated', () => {
    const url = '/api/v1/sourcing/queue?status=REJECTED&page=0&size=10';
    service.getQueue('REJECTED', 0, 10).subscribe();
    http.expectOne(url).flush({
      success: true,
      data: {
        content: [], page: 0, size: 10, totalElements: 0, totalPages: 0,
        summary: { activeCount: 0, rejectedCount: 0, promotedCount: 0 },
      },
    });

    service.invalidateCache();
    service.getQueue('REJECTED', 0, 10).subscribe();

    http.expectOne(url).flush({
      success: true,
      data: {
        content: [], page: 0, size: 10, totalElements: 0, totalPages: 0,
        summary: { activeCount: 0, rejectedCount: 0, promotedCount: 0 },
      },
    });
  });
});
