import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { HeaderComponent } from './layout/header/header.component';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((module) => module.LoginComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'products',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (module) => module.DashboardComponent,
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            (module) => module.ProductListComponent,
          ),
      },
      {
        path: 'ranking',
        loadComponent: () =>
          import('./features/ranking/ranking.component').then((module) => module.RankingComponent),
      },
      {
        path: 'trends',
        loadComponent: () =>
          import('./features/trends/trends.component').then((module) => module.TrendsComponent),
      },
      {
        path: 'heat-tags',
        loadComponent: () =>
          import('./features/heat-tags/heat-tags.component').then(
            (module) => module.HeatTagsComponent,
          ),
      },
      {
        path: 'sourcing',
        loadComponent: () =>
          import('./features/sourcing/sourcing.component').then(
            (module) => module.SourcingComponent,
          ),
      },
      {
        path: 'ai-tasks',
        loadComponent: () =>
          import('./features/ai-tasks/ai-tasks.component').then(
            (module) => module.AiTasksComponent,
          ),
      },
      {
        path: 'weights',
        loadComponent: () =>
          import('./features/weights/weights.component').then((module) => module.WeightsComponent),
      },
      {
        path: 'imports',
        loadComponent: () =>
          import('./features/imports/imports.component').then((module) => module.ImportsComponent),
      },
      {
        path: 'risks',
        loadComponent: () =>
          import('./features/risks/risks.component').then((module) => module.RisksComponent),
      },
      {
        path: 'decisions',
        loadComponent: () =>
          import('./features/decisions/decisions.component').then(
            (module) => module.DecisionsComponent,
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then((module) => module.ReportsComponent),
      },
      {
        path: 'admin',
        loadComponent: () =>
          import('./features/admin/admin.component').then((module) => module.AdminComponent),
      },
    ],
  },
  { path: 'header', component: HeaderComponent },
  { path: '**', redirectTo: '' },
];
