import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./studio-view/studio-view.component').then((m) => m.StudioViewComponent),
  },
  { path: '**', redirectTo: '' },
];
