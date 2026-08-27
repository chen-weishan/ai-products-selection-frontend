import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { BasicAuthService } from './basic-auth.service';
import { basicAuthInterceptor } from './basic-auth.interceptor';

describe('basicAuthInterceptor', () => {
  let httpTesting: HttpTestingController;
  let authService: BasicAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([basicAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(BasicAuthService);
  });

  afterEach(() => httpTesting.verify());

  it('adds Basic authentication to backend requests', () => {
    authService.setCredentials('buyer@ssds.dev', 'secret');
    const http = TestBed.inject(HttpClient);

    http.get(`${environment.apiBaseUrl}/products`).subscribe();

    const request = httpTesting.expectOne(`${environment.apiBaseUrl}/products`);
    expect(request.request.headers.get('Authorization')).toBe(
      `Basic ${btoa('buyer@ssds.dev:secret')}`,
    );
    request.flush({});
  });
});
