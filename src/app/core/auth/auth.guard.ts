import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authservice = inject(AuthService);
  if (authservice.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};
