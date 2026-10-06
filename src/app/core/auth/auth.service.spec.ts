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
    expect(service.currentUser()).toEqual(
      expect.objectContaining({
        email: 'buyer@ssds.dev',
        displayName: 'Buyer',
        roles: ['BUYER'],
      }),
    );
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

  it('switches test accounts using a real login and replaces the previous user and tokens', () => {
    localStorage.setItem('ssds_refresh_Token', 'old-admin-refresh');
    service.currentUser.set({ id: 4, name: '系統管理員', roles: ['SYS_ADMIN'], role: 'SYS_ADMIN' });
    service.loginAsMock('BUYER').subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(request.request.body.email).toBe('buyer@ssds.dev');
    request.flush({ success: true, data: {
      tokens: { accessToken: 'buyer-token' },
      user: { id: 1, email: 'buyer@ssds.dev', displayName: '採購人員', roles: ['BUYER'] }
    } });
    expect(service.currentUser()).toEqual(expect.objectContaining({ id: 1, name: '採購人員', role: 'BUYER', roles: ['BUYER'] }));
    expect(service.getAccessToken()).toBe('buyer-token');
    expect(service.getRefreshToken()).toBeNull();
  });

  it('rejects an unknown test account instead of silently logging in as another user', () => {
    let error: Error | undefined;
    service.loginAsMock('unknown').subscribe({ error: err => error = err });
    expect(error?.message).toContain('找不到');
    http.expectNone(`${environment.apiBaseUrl}/auth/login`);
  });

  it('updates the displayed identity when another tab changes the logged-in account', () => {
    localStorage.setItem('ssds_access_Token', 'buyer-token');
    localStorage.setItem('ssds_user_info', JSON.stringify({ id: 1, name: '採購人員', role: 'SYS_ADMIN', roles: ['BUYER'] }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'ssds_user_info' }));
    expect(service.currentUser()?.name).toBe('採購人員');
    expect(service.currentUser()?.role).toBe('BUYER');
  });
});
