import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { BasicAuthService } from './basic-auth.service';
import { AccessControlService } from './access-control.service';

describe('AccessControlService', () => {
  let service: AccessControlService;
  let basicAuth: BasicAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AccessControlService,
        BasicAuthService,
        { provide: AuthService, useValue: { hasRole: vi.fn(() => false) } },
      ],
    });
    service = TestBed.inject(AccessControlService);
    basicAuth = TestBed.inject(BasicAuthService);
  });

  it('maps the development buyer account to the BUYER role', () => {
    basicAuth.setCredentials('buyer@ssds.dev', 'secret');

    expect(service.hasRole(['BUYER', 'BUYER_LEAD'])).toBe(true);
    expect(service.hasRole(['VIEWER'])).toBe(false);
  });

  it('uses SYS_ADMIN permissions for the default FR03 development account', () => {
    expect(service.hasRole(['SYS_ADMIN'])).toBe(true);
    expect(service.hasRole(['VIEWER'])).toBe(false);
  });
});
