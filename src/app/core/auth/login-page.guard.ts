import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export const loginPageGuard: CanActivateFn = () =>
  environment.fr03DevCredentials ? inject(Router).createUrlTree(['/products']) : true;
