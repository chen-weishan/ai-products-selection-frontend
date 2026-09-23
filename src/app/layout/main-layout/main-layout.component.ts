import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { LayoutService } from '../../services/layout-service';
import { HeaderComponent } from "../header/header.component";
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/models/auth-model';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}


@Component({
  selector: 'app-main-layout',
  imports: [RouterLink, RouterOutlet, RouterLinkActive, MatSidenavModule, MatButtonModule,
    MatListModule, MatIconModule, HeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {

  layoutService = inject(LayoutService);
  private authService = inject(AuthService);

  private readonly allNavItems: NavItem[] = [
    { label: 'S-02 儀表板', path: '/dashboard', icon: 'dashboard' },
    { label: 'S-03 品項清單', path: '/products', icon: 'inventory_2' },
    { label: 'S-05 選品排行', path: '/ranking', icon: 'leaderboard' },
    { label: 'S-07 趨勢分析', path: '/trends', icon: 'trending_up' },
    { label: 'S-15 熱度標記', path: '/heat-tags', icon: 'local_fire_department' },
    { label: 'S-17 尋源探索', path: '/sourcing', icon: 'travel_explore', roles: ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] },
    { label: 'S-08 AI任務', path: '/ai-tasks', icon: 'smart_toy', roles: ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] },
    { label: 'S-09 權重設定', path: '/weights', icon: 'tune', roles: ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] },
    { label: 'S-20 節慶檔期', path: '/festivals', icon: 'event', roles: ['BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] },
    { label: 'S-10 資料匯入', path: '/imports', icon: 'file_upload', roles: ['BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] },
    { label: 'S-11 風險示警', path: '/risks', icon: 'warning' },
    { label: 'S-12 決策紀錄', path: '/decisions', icon: 'history_edu' },
    { label: 'S-13 報表', path: '/reports', icon: 'bar_chart' },
    { label: 'S-14設定', path: '/admin', icon: 'settings', roles: ['BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] },
  ];

  readonly navItems = computed(() => {
    const currentRole = this.authService.currentUser()?.role;
    if (!currentRole) return this.allNavItems;
    return this.allNavItems.filter(item => !item.roles || item.roles.includes(currentRole));
  });

}
