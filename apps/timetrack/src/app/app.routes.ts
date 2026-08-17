import { Routes } from '@angular/router';
import { readViewState } from './view-state';

export const APP_ROUTES: Routes = [
  // A window that opens on the view it was closed on, without the default one being painted first.
  { path: '', pathMatch: 'full', redirectTo: () => readViewState().view ?? 'day' },
  {
    path: 'day',
    title: 'Day',
    loadComponent: () => import('./day-review/day-review-view.component').then((entry) => entry.DayReviewViewComponent),
  },
  {
    path: 'start',
    title: 'Start',
    loadComponent: () => import('./work-start/work-start-view.component').then((entry) => entry.WorkStartViewComponent),
  },
  {
    path: 'week',
    title: 'Week',
    loadComponent: () =>
      import('./week-review/week-review-view.component').then((entry) => entry.WeekReviewViewComponent),
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
