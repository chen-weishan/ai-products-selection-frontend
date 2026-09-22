import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingComponent } from './shared/components/loading/loading.component';
import { LoadingService } from './services/loading-service';
import { loadingInterceptor } from './core/http/loading-interceptor';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ai-products-selection-frontend');
  loadingService = inject(LoadingService);
  private http = inject(HttpClient);

  constructor() {
    console.log('App component created');
    this.http.get('/api/v1/dashboard/summary', { params: { period: '2026W37', track: 'A' } }).subscribe({
      next: (response) => {
        console.log('Dashboard summary received:', response);
      },
      error: (error) => {
        console.error('Error fetching dashboard summary:', error);
      }
    });
  }
}
