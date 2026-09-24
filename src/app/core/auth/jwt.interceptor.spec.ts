import { TestBed } from '@angular/core/testing';
import { HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

import { jwtInterceptor } from './jwt.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('jwtInterceptor', () => {
  const getAccessToken = vi.fn();

  beforeEach(() => {
    getAccessToken.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { getAccessToken } }],
    });
  });

  it('adds a Bearer token to backend requests', () => {
    getAccessToken.mockReturnValue('jwt-token');
    let forwarded: HttpRequest<unknown> | undefined;
    const next: HttpHandlerFn = (request) => {
      forwarded = request;
      return of(new HttpResponse());
    };

    TestBed.runInInjectionContext(() =>
      jwtInterceptor(
        new HttpRequest('GET', `${environment.apiBaseUrl}/products`),
        next,
      ).subscribe(),
    );

    expect(forwarded?.headers.get('Authorization')).toBe('Bearer jwt-token');
  });

  it('does not send the token to external URLs', () => {
    getAccessToken.mockReturnValue('jwt-token');
    let forwarded: HttpRequest<unknown> | undefined;
    const next: HttpHandlerFn = (request) => {
      forwarded = request;
      return of(new HttpResponse());
    };

    TestBed.runInInjectionContext(() =>
      jwtInterceptor(new HttpRequest('GET', 'https://example.com/data'), next).subscribe(),
    );

    expect(forwarded?.headers.has('Authorization')).toBe(false);
  });
});
