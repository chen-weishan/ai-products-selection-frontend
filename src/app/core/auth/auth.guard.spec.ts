import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const isLoggedIn = vi.fn();
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  beforeEach(() => {
    isLoggedIn.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn },
        },
      ],
    });
  });

  it('allows navigation when a JWT session exists', () => {
    isLoggedIn.mockReturnValue(true);

    expect(runGuard(executeGuard, '/products')).toBe(true);
  });

  it('redirects to login and preserves the requested URL', () => {
    isLoggedIn.mockReturnValue(false);
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
