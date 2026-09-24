import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('logs in with the backend contract and stores the JWT user state', () => {
    service.login({ email: 'buyer@ssds.dev', password: 'secret' }).subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'buyer@ssds.dev', password: 'secret' });
    request.flush({
      accessToken: 'jwt-token',
      email: 'buyer@ssds.dev',
      displayName: 'Buyer',
      roles: ['BUYER'],
    });

    expect(service.getAccessToken()).toBe('jwt-token');
    expect(service.currentUser()).toEqual({
      email: 'buyer@ssds.dev',
      displayName: 'Buyer',
      roles: ['BUYER'],
    });
    expect(service.isLoggedIn()).toBe(true);
    expect(service.hasRole(['BUYER', 'BUYER_LEAD'])).toBe(true);
  });

  it('clears authentication state on logout', () => {
    localStorage.setItem('ssds_access_token', 'jwt-token');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    service.logout();

    expect(service.getAccessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
