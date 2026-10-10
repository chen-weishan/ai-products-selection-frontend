import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_GLOBAL_LOADING } from '../../core/http/loading-interceptor';
import { environment } from '../../../environments/environment';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AdminUsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses the page loading state instead of the global overlay for reads', () => {
    service.list().subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/admin/users`);
    expect(request.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    request.flush({ success: true, data: [] });
  });

  it('uses the page saving state instead of the global overlay for mutations', () => {
    service.resetPassword(7, 'NewPassword9').subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/admin/users/7/password`);
    expect(request.request.context.get(SKIP_GLOBAL_LOADING)).toBe(true);
    request.flush({
      success: true,
      data: {
        id: 7,
        email: 'buyer@ssds.dev',
        displayName: '採購',
        status: 'ACTIVE',
        roles: ['BUYER'],
        locked: false,
        lockedUntil: null,
        failedAttempts: 0,
        createdAt: null,
        updatedAt: null,
      },
    });
  });
});
