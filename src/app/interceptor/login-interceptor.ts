import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';

export const loginInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/auth/login')) {
    return next(req);
  }

  const authservice = inject(AuthService);
  const token = authservice.getAccessToken();

  if (token) {
    const cloneReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(cloneReq);
  }

  return next(req);
};

