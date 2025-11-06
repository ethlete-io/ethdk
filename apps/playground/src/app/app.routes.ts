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
      {
        path: 'signals',
        loadComponent: () => import('./query/signals/signals.component').then((m) => m.QuerySignalsComponent),
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
  {
    path: 'contentful',
    children: [
      {
        path: '',
        loadComponent: () => import('./contentful/rich-text.component').then((m) => m.RichTextComponent),
      },
    ],
  },
  {
    path: 'cdk',
    children: [
      {
        path: 'scrollable',
        loadComponent: () => import('./cdk/scrollable/scrollable.component').then((m) => m.ScrollableWrapperComponent),
      },
      {
        path: 'combobox',
        loadComponent: () => import('./cdk/combobox/combobox.component').then((m) => m.PlaygroundComboboxComponent),
      },
      {
        path: 'props',
        loadComponent: () => import('./cdk/props/props.component').then((m) => m.PropsTestComponent),
      },
    ],
  },
];
