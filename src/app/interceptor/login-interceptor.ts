import { HttpInterceptorFn } from '@angular/common/http';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

export const loginInterceptor: HttpInterceptorFn = (req, next) => {
  console.log('Login interceptor called');
  const authReq = req.clone({
    setHeaders: {
      Authorization: 'Basic ' + btoa('dev:dev1234')
    }
  });
  return next(authReq);
};
