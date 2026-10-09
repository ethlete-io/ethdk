import { Routes } from '@angular/router';
import { readViewState } from './view-state';

export const APP_ROUTES: Routes = [
  // A window that opens on the view it was closed on, without the default one being painted first.
  { path: '', pathMatch: 'full', redirectTo: () => readViewState().view ?? 'day' },
  // A window closed on the retired Today view opens on the day screen it merged into.
  { path: 'today', pathMatch: 'full', redirectTo: 'day' },
  {
    path: 'day',
    title: 'Day',
    loadComponent: () => import('./day-review/day-review-view.component').then((entry) => entry.DayReviewViewComponent),
  },
  // Start and week have no sidebar entry. They are reached by URL, and by the buttons that
  // route to them, so an unreferenced route here is not a dead one.
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
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'day' },
      {
        path: 'day',
        loadComponent: () =>
          import('./settings/settings-day-view.component').then((entry) => entry.SettingsDayViewComponent),
      },
      {
        path: 'jira',
        loadComponent: () =>
          import('./settings/settings-jira-view.component').then((entry) => entry.SettingsJiraViewComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./settings/settings-projects-view.component').then((entry) => entry.SettingsProjectsViewComponent),
      },
      {
        path: 'sources',
        loadComponent: () =>
          import('./settings/settings-sources-view.component').then((entry) => entry.SettingsSourcesViewComponent),
      },
      {
        path: 'suggestions',
        loadComponent: () =>
          import('./settings/settings-suggestions-view.component').then(
            (entry) => entry.SettingsSuggestionsViewComponent,
          ),
      },
    ],
  },
  {
    path: 'host',
    title: 'Host',
    loadComponent: () =>
      import('./host-status/host-status-view.component').then((entry) => entry.HostStatusViewComponent),
  },
  { path: '**', redirectTo: 'day' },
];
