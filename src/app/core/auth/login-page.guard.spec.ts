import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { loginPageGuard } from './login-page.guard';

describe('loginPageGuard', () => {
  const productsTree = { products: true };
  const isLoggedIn = vi.fn();
  const executeGuard: CanActivateFn = (...parameters) =>
    TestBed.runInInjectionContext(() => loginPageGuard(...parameters));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn } },
        { provide: Router, useValue: { createUrlTree: vi.fn(() => productsTree) } },
      ],
    });
  });

  it('redirects authenticated users to products', () => {
    isLoggedIn.mockReturnValue(true);
    expect(executeGuard({} as never, {} as never)).toBe(productsTree);
  });

  it('allows anonymous users to open the login page', () => {
    isLoggedIn.mockReturnValue(false);
    expect(executeGuard({} as never, {} as never)).toBe(true);
  });
});
