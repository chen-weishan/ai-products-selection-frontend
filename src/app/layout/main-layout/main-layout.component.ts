import { Component,signal} from '@angular/core';
import{RouterLink,RouterOutlet,RouterLinkActive} from '@angular/router';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatButtonModule} from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

interface NavItem{
  path:string;
  label:string;
}


@Component({
  selector: 'app-main-layout',
  imports: [RouterLink,RouterOutlet,RouterLinkActive,MatSidenavModule,MatButtonModule
    ,MatListModule,MatIconModule
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {
readonly isCollapsed=signal(false);
showFiller = signal(false);

readonly navItems = signal<NavItem[]>([
    { label: 'S-02 儀表板', path: '/dashboard' },
    { label: 'S-03 品項清單', path: '/products' },
    { label: 'S-05 選品排行', path: '/ranking' },
    { label:'S-07 趨勢分析',path:'/trends'},
    { label:'S-15 熱度標記',path:'/heat-tags'},
    { label:'S-17 尋源探索',path:'/sourcing'},
    { label:'S-08 AI任務',path:'/ai-tasks'},
    { label:'S-09 權重設定',path:'/weights'},
    { label:'S-10 資料匯入',path:'/imports'},
    { label:'S-11 風險示警',path:'/risks'},
    { label:'S-12 決策紀錄',path:'/decisions'},
    { label:'S-13 報表',path:'/reports'},
    { label:'S-14設定',path:'/admin'},
  ]);

toggleSidebar(): void {
    this.isCollapsed.update(val => !val);
  }
}
