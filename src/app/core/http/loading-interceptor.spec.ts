import { TestBed } from '@angular/core/testing';
import { HttpContext, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

import { LoadingService } from '../../services/loading-service';
import { loadingInterceptor, SKIP_GLOBAL_LOADING } from './loading-interceptor';

describe('loadingInterceptor', () => {
  const interceptor: HttpInterceptorFn = (req, next) =>
    TestBed.runInInjectionContext(() => loadingInterceptor(req, next));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  it('does not show the full-page overlay for background requests', () => {
    const loading = TestBed.inject(LoadingService);
    const show = vi.spyOn(loading, 'show');
    const hide = vi.spyOn(loading, 'hide');
    const request = new HttpRequest('GET', '/api/v1/imports/6', null, {
      context: new HttpContext().set(SKIP_GLOBAL_LOADING, true),
    });

    interceptor(request, () => of(new HttpResponse({ status: 200 }))).subscribe();

    expect(show).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
  });
});
