import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BasicAuthService } from './basic-auth.service';

export const basicAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const authorization = inject(BasicAuthService).authorizationHeader();
  const isBackendRequest = request.url.startsWith(environment.apiBaseUrl);

  if (
    !environment.useBasicAuth ||
    !isBackendRequest ||
    !authorization ||
    request.headers.has('Authorization')
  ) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: { Authorization: authorization },
    }),
  );
};
