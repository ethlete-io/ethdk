# File structure

Read this file when placing routes, views, components, providers, or local utilities.

Mirror the route tree in folders and suffix routing components with `-view`:

```ts
import { Routes } from '@angular/router';

export const SHOP_ROUTES: Routes = [
  {
    path: 'items',
    loadComponent: () =>
      import('./items-list-view/items-list-view.component').then((module) => module.ItemsListViewComponent),
  },
  {
    path: 'items/:id',
    loadComponent: () =>
      import('./item-detail-host-view/item-detail-host-view.component').then(
        (module) => module.ItemDetailHostViewComponent,
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./item-detail-host-view/item-detail-view/item-detail-view.component').then(
            (module) => module.ItemDetailViewComponent,
          ),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./item-detail-host-view/item-reviews-view/item-reviews-view.component').then(
            (module) => module.ItemReviewsViewComponent,
          ),
      },
    ],
  },
];
```

Use these placement rules:

- Put reusable view-level pieces in `components/`.
- Put children used only by one parent in that parent's `partials/`.
- Put generic presentation-only pieces in `uikit/`.
- Put application-shell pieces in `shell/`.
- Keep a directive, pipe, provider, form configuration, or utility beside its narrowest
  consumer. Move it upward only when more consumers appear.
- Use simple utility names such as `items-list-filter-form.ts`, not `.utils.ts`.
- Give exportable folders an `index.ts`, but import source files directly. Do not import
  a parent barrel from its subdirectory.
- Keep application projects thin; move shared or domain logic into buildable libraries
  with clear import paths.

```plaintext
shop/
├── items-list-view/
│   ├── components/
│   │   └── item-card/
│   │       ├── partials/
│   │       │   ├── item-image/
│   │       │   └── item-price/
│   │       ├── item-card.component.ts
│   │       └── item-card.component.html
│   ├── items-list-filter-form.ts
│   └── items-list-view.component.ts
└── item-detail-host-view/
    ├── item-detail-view/
    ├── item-reviews-view/
    ├── item-detail.provider.ts
    └── item-detail-host-view.component.ts
```
