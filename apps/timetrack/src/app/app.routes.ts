import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'day' },
  {
    path: 'day',
    title: 'Day',
    loadComponent: () => import('./day-review/day-review-view.component').then((entry) => entry.DayReviewViewComponent),
  },
  {
    path: 'sync',
    title: 'Sync',
    loadComponent: () => import('./sync/sync-view.component').then((entry) => entry.SyncViewComponent),
  },
  {
    path: 'sources',
    title: 'Sources',
    loadComponent: () => import('./sources/sources-view.component').then((entry) => entry.SourcesViewComponent),
  },
  {
    path: 'settings',
    title: 'Settings',
    loadComponent: () => import('./settings/settings-view.component').then((entry) => entry.SettingsViewComponent),
  },
  {
    path: 'host',
    title: 'Host',
    loadComponent: () =>
      import('./host-status/host-status-view.component').then((entry) => entry.HostStatusViewComponent),
  },
  { path: '**', redirectTo: 'day' },
];
