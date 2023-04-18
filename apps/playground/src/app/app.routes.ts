import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: 'query',
    children: [
      {
        path: 'entity',
        loadComponent: () => import('./query/entity/entity.component').then((m) => m.EntityTestComponent),
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
