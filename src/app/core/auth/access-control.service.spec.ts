import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AccessControlService } from './access-control.service';

describe('AccessControlService', () => {
  let service: AccessControlService;
  const hasRole = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccessControlService, { provide: AuthService, useValue: { hasRole } }],
    });
    service = TestBed.inject(AccessControlService);
    hasRole.mockReset();
  });

  it('delegates role checks to the JWT auth state', () => {
    hasRole.mockReturnValue(true);

    expect(service.hasRole(['BUYER', 'BUYER_LEAD'])).toBe(true);
    expect(hasRole).toHaveBeenCalledWith(['BUYER', 'BUYER_LEAD']);
  });
});
