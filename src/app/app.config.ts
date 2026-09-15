import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { loadingInterceptor } from './core/http/loading-interceptor';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { BASE_PATH } from './api/variables';
import { environment } from '../environments/environment';
import { jwtInterceptor } from './core/auth/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    { provide: BASE_PATH, useValue: environment.apiBaseUrl },
    provideHttpClient(withInterceptors([jwtInterceptor, loadingInterceptor])),
  ],
};
