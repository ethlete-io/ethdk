import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'query',
    children: [
      {
        path: 'entity',
        loadComponent: () => import('./query/entity/entity.component').then((m) => m.EntityTestComponent),
      },
      {
        path: 'infinity',
        loadComponent: () => import('./query/infinity/infinity.component').then((m) => m.QueryInfinityComponent),
      },
      {
        path: 'form',
        loadComponent: () => import('./query/form/form.component').then((m) => m.QueryFormComponent),
      },
    ],
  },
  {
    path: 'dsp',
    children: [
      {
        path: '',
        loadComponent: () => import('./dsp/dsp.component').then((m) => m.DspComponent),
      },
    ],
  },
];
