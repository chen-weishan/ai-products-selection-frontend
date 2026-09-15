import { Component, inject, signal } from '@angular/core';
import { LayoutService } from '../../services/layout-service';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-header',
  imports: [MatIcon, MatButtonModule, MatIconModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  layoutService = inject(LayoutService);
  private readonly auth = inject(AuthService);
  //假資料
  readonly navItems = signal<NavItem[]>([
    { label: '登出', path: '/login', icon: 'logout' },
    { label: '管理員', path: '/admin', icon: 'admin_panel_settings' },
    { label: '用戶管理', path: '/user', icon: 'people' },
  ]);

  logout(): void {
    this.auth.logout();
  }
}
