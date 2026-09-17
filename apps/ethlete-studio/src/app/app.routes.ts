import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./home-view/home-view.component').then((m) => m.HomeViewComponent),
  },
  { path: '**', redirectTo: '' },
];
