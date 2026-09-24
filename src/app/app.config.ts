import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { loadingInterceptor } from './core/http/loading-interceptor';
import { loginInterceptor } from './interceptor/login-interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BASE_PATH } from './api';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([
      loadingInterceptor,
      loginInterceptor,
      errorInterceptor
    ])),
    { provide: BASE_PATH, useValue: '/api/v1' }
  ]
};
