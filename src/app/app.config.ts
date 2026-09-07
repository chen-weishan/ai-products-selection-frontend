import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { loadingInterceptor } from './core/http/loading-interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { loginInterceptor } from './interceptor/login-interceptor';
import { BASE_PATH } from './api';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([loadingInterceptor,
      loginInterceptor
    ])),
    { provide: BASE_PATH, useValue: '/api/v1' }
  ]
};
