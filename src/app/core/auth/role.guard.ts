import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from '../models/auth-model';

export const roleGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const expectedRoles = route.data?.['roles'] as UserRole[] | undefined;

  // 若該路由未限制角色，直接放行
  if (!expectedRoles || expectedRoles.length === 0) {
    return true;
  }

  // 驗證當前使用者角色是否符合
  if (authService.hasRole(expectedRoles)) {
    return true;
  }

  console.warn(`[roleGuard] 權限不足: 當前使用者角色為 '${authService.currentUser()?.role}'，無法存取 '${state.url}'`);
  return router.createUrlTree(['/dashboard']);
};

