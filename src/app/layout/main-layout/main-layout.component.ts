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
  /** 子路徑另有選單項目時設 true，避免兩項同時高亮（/weights vs /weights/calibration）。 */
  exact?: boolean;
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
    { label: '儀表板', path: '/dashboard', icon: 'dashboard' },
    { label: '品項清單', path: '/products', icon: 'inventory_2' },
    { label: '選品排行', path: '/ranking', icon: 'leaderboard' },
    { label: '趨勢分析', path: '/trends', icon: 'trending_up' },
    { label: '熱度標記', path: '/heat-tags', icon: 'local_fire_department' },
    { label: '尋源探索', path: '/sourcing', icon: 'travel_explore' },
    { label: 'AI任務', path: '/ai-tasks', icon: 'smart_toy' },
    { label: '權重設定', path: '/weights', icon: 'tune', exact: true },
    { label: '權重校準', path: '/weights/calibration', icon: 'model_training' },
    { label: '節慶檔期', path: '/festivals', icon: 'event' },
    { label: '資料匯入', path: '/imports', icon: 'file_upload' },
    { label: '風險示警', path: '/risks', icon: 'warning' },
    { label: '決策紀錄', path: '/decisions', icon: 'history_edu' },
    { label: '報表', path: '/reports', icon: 'bar_chart' },
    { label: '設定', path: '/admin', icon: 'settings' },
  ];

  private readonly navPathsByRole: Record<UserRole, readonly string[]> = {
    BUYER: ['/dashboard', '/products', '/ranking', '/trends', '/heat-tags', '/sourcing', '/risks', '/decisions', '/reports'],
    BUYER_LEAD: ['/dashboard', '/weights', '/weights/calibration', '/ranking', '/reports'],
    DATA_ADMIN: ['/dashboard', '/trends', '/festivals', '/imports'],
    SYS_ADMIN: this.allNavItems.map(item => item.path),
    VIEWER: ['/dashboard', '/products', '/ranking', '/trends', '/risks', '/decisions', '/reports'],
  };
  readonly navItems = computed(() => {
    const user = this.authService.currentUser();
    const roles = user?.roles?.length ? user.roles : (user?.role ? [user.role] : []);
    if (roles.includes('SYS_ADMIN')) return this.allNavItems;

    // 多角色帳號依角色順序合併可見項目，並移除重複項目。
    const paths = new Set(roles.flatMap(role => this.navPathsByRole[role] ?? []));
    return [...paths].flatMap(path => {
      const item = this.allNavItems.find(item => item.path === path);
      return item ? [item] : [];
    });
  });

}
