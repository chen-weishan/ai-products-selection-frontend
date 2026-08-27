import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { BasicAuthService } from './basic-auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const hasCredentials = vi.fn();
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  beforeEach(() => {
    hasCredentials.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: BasicAuthService,
          useValue: { hasCredentials },
        },
      ],
    });
  });

  it('allows navigation when Basic credentials exist', () => {
    hasCredentials.mockReturnValue(true);

    expect(runGuard(executeGuard, '/products')).toBe(true);
  });

  it('redirects to login and preserves the requested URL', () => {
    hasCredentials.mockReturnValue(false);
    const result = runGuard(executeGuard, '/products');

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/login?returnUrl=%2Fproducts',
    );
  });
});

function runGuard(guard: CanActivateFn, url: string): ReturnType<CanActivateFn> {
  return guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot);
}
