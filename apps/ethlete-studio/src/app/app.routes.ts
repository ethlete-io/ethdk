import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./call-view/call-view.component').then((m) => m.CallViewComponent),
  },
  {
    path: 'agent',
    loadComponent: () => import('./agent-view/agent-view.component').then((m) => m.AgentViewComponent),
  },
  { path: '**', redirectTo: '' },
];
