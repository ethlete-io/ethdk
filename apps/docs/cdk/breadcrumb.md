# Breadcrumb

A DI-based breadcrumb system: each routed page registers its breadcrumb as a template, and a single outlet in the app shell renders whichever page is active. The breadcrumb collapses into an overflow menu when it runs out of horizontal space.

<StoryEmbed id="cdk-breadcrumb--default" height="220px" />

## Setup

Register the manager once at the root:

```ts
providers: [provideBreadcrumbManager(), provideRouter(routes)];
```

Place the outlet in your shell, outside the router outlet:

```html
<et-breadcrumb-outlet /> <router-outlet />
```

## Registering breadcrumbs per page

A routed page declares its breadcrumb inside an `etBreadcrumbTemplate` — the directive registers it with the manager on creation and unregisters on destroy, so navigation swaps the rendered breadcrumb automatically:

```html
<ng-template etBreadcrumbTemplate>
  <et-breadcrumb>
    <ng-template etBreadcrumbItemTemplate>
      <a etBreadcrumbItem routerLink="/products">Products</a>
    </ng-template>
    <ng-template etBreadcrumbItemTemplate>
      <a [routerLink]="['/products', category()]" etBreadcrumbItem>{{ categoryName() }}</a>
    </ng-template>
    <ng-template etBreadcrumbItemTemplate>
      <span etBreadcrumbItem>{{ productName() }}</span>
    </ng-template>
  </et-breadcrumb>
</ng-template>
```

```ts
import { BreadcrumbImports } from '@ethlete/cdk';
```

Each crumb is its own `etBreadcrumbItemTemplate` wrapping an `[etBreadcrumbItem]` anchor or span. While data is still loading, add the `loading` attribute to an item template and it renders a skeleton placeholder instead of its content.

## Overflow behavior

When the breadcrumb can't fit all items, it keeps the first and last crumb visible and collapses the middle ones into a "…" trigger that opens a menu of the hidden items (at least three elements always stay visible). The collapse recalculates on resize and when items change. The menu placement offset is adjustable via the `offset` input on `et-breadcrumb` (a `@floating-ui/dom` offset, default `{ mainAxis: 0 }`).

## Styling

Style against `et-breadcrumb`, `et-breadcrumb-item`, `et-breadcrumb-chevron` (the separator) and `et-breadcrumb-menu` (the overflow menu). The stylesheet exposes a set of `--_breadcrumb-*` custom properties for gaps, divider and item colors, the last-child emphasis and the menu trigger.
