import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginRequest = req.url.includes('/auth/login');
      if (!isLoginRequest) {
        if (error.status === 401) {
          authService.logout();
        } else if (error.status === 403) {
          // 若收到 403 且 Token 已過期或不存在（Spring Security 因未通過驗證丟 403），自動清理登入狀態並導向 /login
          const token = authService.getAccessToken();
          if (!token || authService.isTokenExpired(token)) {
            authService.logout();
          }
        }
      }
      return throwError(() => error);
    })
  );
};
