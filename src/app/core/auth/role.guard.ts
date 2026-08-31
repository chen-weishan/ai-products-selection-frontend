import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/auth-model';
import { AccessControlService } from './access-control.service';

export const roleGuard: CanActivateFn = (route) => {
  const accessControl = inject(AccessControlService);
  const router = inject(Router);
  const roles = (route.data['roles'] ?? []) as UserRole[];

  return roles.length === 0 || accessControl.hasRole(roles)
    ? true
    : router.createUrlTree(['/products']);
};
