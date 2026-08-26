import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingComponent } from "./shared/components/loading/loading.component";
import { LoadingService } from './services/loading-service';
import { loadingInterceptor } from './core/http/loading-interceptor';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ai-products-selection-frontend');
  loadingService = inject(LoadingService);
}
