import { Routes } from '@angular/router';
import {MainLayoutComponent} from './layout/main-layout/main-layout.component';
import {HeaderComponent} from './layout/header/header.component';
export const routes: Routes = [
{path:'',component:MainLayoutComponent,
  children:[
    {
        path: '',
        redirectTo: 'products',
        pathMatch: 'full'
      },
    {path:'dashboard',loadComponent:()=>
      import('./features/dashboard/dashboard.component').then(
        m => m.DashboardComponent
      )
    },
     {path:'products',loadComponent:()=>
      import('./features/products/product-list/product-list.component').then(
        m => m.ProductListComponent
      )
    },
    {path:'ranking',loadComponent:()=>
      import('./features/ranking/ranking.component').then(
        m => m.RankingComponent
      )
    },

    {path:'trends',loadComponent:()=>
      import('./features/trends/trends.component').then(
        m => m.TrendsComponent
      )
    },
    {path:'heat-tags',loadComponent:()=>
      import('./features/heat-tags/heat-tags.component').then(
        m => m.HeatTagsComponent
      )
    },
    {path:'sourcing',loadComponent:()=>
      import('./features/sourcing/sourcing.component').then(
        m => m.SourcingComponent
      )
    },
    {path:'ai-tasks',loadComponent:()=>
      import('./features/ai-tasks/ai-tasks.component').then(
        m => m.AiTasksComponent
      )
    },
    {path:'weights',loadComponent:()=>
      import('./features/weights/weights.component').then(
        m => m.WeightsComponent
      )
    },
    {path:'imports',loadComponent:()=>
      import('./features/imports/imports.component').then(
        m => m.ImportsComponent
      )
    },
    {path:'risks',loadComponent:()=>
      import('./features/risks/risks.component').then(
        m => m.RisksComponent
      )
    },
    {path:'decisions',loadComponent:()=>
      import('./features/decisions/decisions.component').then(
        m => m.DecisionsComponent
      )
    },
    {path:'reports',loadComponent:()=>
      import('./features/reports/reports.component').then(
        m => m.ReportsComponent
      )
    },
    {path:'admin',loadComponent:()=>
      import('./features/admin/admin.component').then(
        m => m.AdminComponent
      )
    },
  ]
},
{path:'header',component:HeaderComponent,}



];
