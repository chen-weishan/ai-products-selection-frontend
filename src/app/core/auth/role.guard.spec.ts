import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';

import { AccessControlService } from './access-control.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => roleGuard(...guardParameters));

  const hasRole = vi.fn();
  const deniedTree = { denied: true };

  beforeEach(() => {
    hasRole.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessControlService, useValue: { hasRole } },
        { provide: Router, useValue: { createUrlTree: vi.fn(() => deniedTree) } },
      ],
    });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });

  it('allows a user with an accepted role', () => {
    hasRole.mockReturnValue(true);

    expect(executeGuard({ data: { roles: ['BUYER'] } } as never, {} as never)).toBe(true);
    expect(hasRole).toHaveBeenCalledWith(['BUYER']);
  });

  it('redirects a user without an accepted role', () => {
    hasRole.mockReturnValue(false);

    expect(executeGuard({ data: { roles: ['SYS_ADMIN'] } } as never, {} as never)).toBe(deniedTree);
  });
});
