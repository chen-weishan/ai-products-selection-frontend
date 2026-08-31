import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router } from '@angular/router';
import { loginPageGuard } from './login-page.guard';

describe('loginPageGuard', () => {
  const productsTree = { products: true };
  const executeGuard: CanActivateFn = (...parameters) =>
    TestBed.runInInjectionContext(() => loginPageGuard(...parameters));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: vi.fn(() => productsTree) } }],
    });
  });

  it('redirects the development login page to products', () => {
    expect(executeGuard({} as never, {} as never)).toBe(productsTree);
  });
});
