import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { HeaderComponent } from './layout/header/header.component';
import { TrendDetailComponent } from './features/trend-detail/trend-detail.component';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { ForgetPasswordComponent } from './features/auth/forget-password/forget-password.component';

export const routes: Routes = [

  {
    path: 'login', loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'forget-password', loadComponent: () =>
      import('./features/auth/forget-password/forget-password.component').then(m => m.ForgetPasswordComponent)
  },

  {
    path: '', component: MainLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard, roleGuard],
    children: [
      {
        path: '',
        redirectTo: 'products',
        pathMatch: 'full'
      },
      {
        path: 'dashboard', loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            m => m.DashboardComponent
          )
      },
      {
        path: 'products', loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            m => m.ProductListComponent
          )
      },
      {
        path: 'ranking', loadComponent: () =>
          import('./features/ranking/ranking.component').then(
            m => m.RankingComponent
          )
      },

      {
        path: 'trends', loadComponent: () =>
          import('./features/trends/trends.component').then(
            m => m.TrendsComponent
          )
      },
      {
        path: 'heat-tags', loadComponent: () =>
          import('./features/heat-tags/heat-tags.component').then(
            m => m.HeatTagsComponent
          )
      },
      {
        path: 'heat-sources', loadComponent: () =>
          import('./features/heat-sources/heat-sources.component').then(
            m => m.HeatSourcesComponent
          )
      },
      {
        path: 'sourcing', loadComponent: () =>
          import('./features/sourcing/sourcing.component').then(
            m => m.SourcingComponent
          ),
        data: { roles: ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] }
      },
      {
        path: 'sourcing-queue', loadComponent: () =>
          import('./features/sourcing-queue/sourcing-queue.component').then(
            m => m.SourcingQueueComponent
          ),
        data: { roles: ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] }
      },
      {
        path: 'ai-tasks', loadComponent: () =>
          import('./features/ai-tasks/ai-tasks.component').then(
            m => m.AiTasksComponent
          ),
        data: { roles: ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] }
      },
      {
        path: 'weights', loadComponent: () =>
          import('./features/weights/weights.component').then(
            m => m.WeightsComponent
          ),
        data: { roles: ['BUYER', 'BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] }
      },
      {
        path: 'festivals', loadComponent: () =>
          import('./features/festivals/festivals.component').then(
            m => m.FestivalsComponent
          ),
        data: { roles: ['BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] }
      },
      {
        path: 'imports', loadComponent: () =>
          import('./features/imports/imports.component').then(
            m => m.ImportsComponent
          ),
        data: { roles: ['BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] }
      },
      {
        path: 'risks', loadComponent: () =>
          import('./features/risks/risks.component').then(
            m => m.RisksComponent
          )
      },
      {
        path: 'decisions', loadComponent: () =>
          import('./features/decisions/decisions.component').then(
            m => m.DecisionsComponent
          )
      },
      {
        path: 'reports', loadComponent: () =>
          import('./features/reports/reports.component').then(
            m => m.ReportsComponent
          )
      },
      {
        path: 'admin', loadComponent: () =>
          import('./features/admin/admin.component').then(
            m => m.AdminComponent
          ),
        data: { roles: ['BUYER_LEAD', 'DATA_ADMIN', 'SYS_ADMIN'] }
      },
      {
        path: 'trends/:keywordId', loadComponent: () =>
          import('./features/trend-detail/trend-detail.component').then(
            m => m.TrendDetailComponent
          )
      }
    ]
  },
  { path: 'header', component: HeaderComponent, },
  { path: '**', redirectTo: 'products' },




];
