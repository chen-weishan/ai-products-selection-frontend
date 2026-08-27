import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { BasicAuthService } from './basic-auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(BasicAuthService);
  if (auth.hasCredentials()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
