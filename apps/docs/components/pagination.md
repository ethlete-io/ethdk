# Pagination

A page-number paginator: first / previous / next / last jump controls around a
window of page numbers, with `…` ellipses for large page counts. Signals-first —
`page` is a two-way model you bind to your data source.

```ts
import { PAGINATION_IMPORTS } from '@ethlete/components';
```

## Usage

Bind the current `page` and the `totalPages`; the component renders the rest.

```ts
@Component({
  imports: [PAGINATION_IMPORTS],
  template: `<et-pagination [(page)]="page" [totalPages]="totalPages()" />`,
})
export class ResultsComponent {
  page = signal(1);
  totalPages = computed(() => Math.ceil(this.totalHits() / this.pageSize()));
}
```

<StoryEmbed id="components-pagination--default" height="200px" />

For large counts, far pages collapse behind ellipses around the current page and
each edge (`1 … 45 46 47 … 200`):

<StoryEmbed id="components-pagination--many-pages" height="200px" />

## Inputs

| Input              | Default        | Description                                   |
| ------------------ | -------------- | --------------------------------------------- |
| `page`             | `1`            | The current page (1-based). Two-way bindable. |
| `totalPages`       | `1`            | Total number of pages.                        |
| `siblingCount`     | `1`            | Pages shown on each side of the current page. |
| `boundaryCount`    | `1`            | Pages shown at each edge before an ellipsis.  |
| `hideFirstLast`    | `false`        | Omit the first/last jump controls.            |
| `hidePreviousNext` | `false`        | Omit the previous/next controls.              |
| `ariaLabel`        | `'Pagination'` | Accessible label for the navigation landmark. |

## Headless

`et-pagination` applies the headless `etPagination` directive via `hostDirectives`.
Use the directive directly for a bespoke layout — it owns the `page` model and
exposes `items()` (the ordered `PaginationItem[]` of page numbers, jump controls
and ellipses) plus `goTo(page)` / `first()` / `previous()` / `next()` / `last()`.
The pure `paginate(options)` function is exported too, for computing the item list
outside Angular.

## Server data & tables

Derive `totalPages` from your list envelope's `totalPageCount` (or
`Math.ceil(totalHits / itemsPerPage)`), and bind `page` to your query state. With
the [table](/components/table)'s `tableRowsFromQuery` adapter, wire the paginator's
`page` to the adapter's `page` / `setPage`:

```ts
const rows = tableRowsFromQuery({ queryCreator, args, toRows, toTotal });
// totalPages from the envelope; page two-way to the adapter
```

```html
<et-table [data]="rows.rows()" [columns]="columns" sortMode="server" />
<et-pagination [page]="rows.page()" [totalPages]="totalPages()" (pageChange)="rows.setPage($event)" />
```

## Accessibility

The host is a `nav` landmark (`role="navigation"`, `aria-label`). Each control is a
real `<button>` with a descriptive `aria-label` ("Page 3", "Previous page"); the
current page sets `aria-current="page"`, and unavailable controls (previous on the
first page, etc.) are `disabled`. Ellipses are inert and `aria-hidden`.

## Theming

Colors come from the surface and color token systems: page/control text from
`--et-surface-color-*-solid`, the hover tint from `--et-surface-interaction-solid`,
and the current page's fill from the nearest color scope
(`--et-theme-color-primary-solid` / `--et-theme-color-on-primary-solid`). Size and
spacing are tunable via `--et-pagination-item-size`, `--et-pagination-gap` and
`--et-pagination-radius`.

::: info Not yet
Link mode (real `href`s / router-driven, SEO-crawlable) and the SEO head service
(canonical tags, paged `<title>`s) are planned follow-ups; today the paginator is
button/state driven.
:::
