import { Component, computed, inject } from '@angular/core';
import { LayoutService } from '../../services/layout-service';
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { USER_ROLE_LABELS } from '../../core/models/auth-model';

@Component({
  selector: 'app-header',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  layoutService = inject(LayoutService);
  private authService = inject(AuthService);

  readonly currentUser = this.authService.currentUser;

  readonly roleLabel = computed(() => {
    const role = this.currentUser()?.role;
    return role ? USER_ROLE_LABELS[role] || role : '';
  });

  logout(): void {
    this.authService.logout();
  }
}

