# Pagination

A page-number paginator: first / previous / next / last jump controls around a
window of page numbers, with `…` ellipses for large page counts. Signals-first —
`page` is a two-way model you bind to your data source. Items render with the
shared [`[et-button]`](/components/button), so the paginator inherits the button
system's variants, focus rings, theming and interaction states.

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

## Range readout & jump-to-page

Pass `totalItems` **and** `pageSize` to show a "Showing X–Y of Z" readout, and set
`showJumpTo` for a number field that jumps straight to a page — both handy for
large result sets.

```html
<et-pagination [(page)]="page" [totalPages]="totalPages()" [totalItems]="total()" [pageSize]="20" showJumpTo />
```

<StoryEmbed id="components-pagination--with-range-and-jump" height="220px" />

## Links mode & SEO

By default items are `<button>`s (pure client state). For crawlable pagination,
set `renderAs="links"` and provide a `urlForPage` mapping — items render as real
`<a href>`s. Plain left-clicks are intercepted (no full reload) so the `page` model
still drives everything; modified clicks (⌘/Ctrl/Shift/middle) open the URL as the
browser normally would.

```html
<et-pagination [(page)]="page" [totalPages]="totalPages()" [urlForPage]="urlForPage" renderAs="links" />
```

```ts
urlForPage = (page: number) => `/results?page=${page}`;
```

<StoryEmbed id="components-pagination--links" height="200px" />

For paged SEO — a per-page canonical link plus `rel="prev"`/`rel="next"` — add the
opt-in `etPaginationSeo` directive. It's a separate import (the base paginator never
pulls it in, so bundles that don't need head management stay lean) built on the
non-deprecated core head-binding utils, so it's SSR-safe and cleans itself up on
destroy.

```ts
import { PaginationSeoDirective, PAGINATION_IMPORTS } from '@ethlete/components';
```

```html
<et-pagination
  [(page)]="page"
  [totalPages]="totalPages()"
  [urlForPage]="urlForPage"
  [etPaginationSeo]="urlForPage"
  [pageTitle]="pageTitle"
  renderAs="links"
/>
```

```ts
// canonical + prev/next come from urlForPage; pageTitle is optional
pageTitle = (page: number) => (page > 1 ? `Results – Page ${page}` : null);
```

## Inputs

| Input              | Default        | Description                                                                         |
| ------------------ | -------------- | ----------------------------------------------------------------------------------- |
| `page`             | `1`            | The current page (1-based). Two-way bindable.                                       |
| `totalPages`       | `1`            | Total number of pages.                                                              |
| `siblingCount`     | `1`            | Pages shown on each side of the current page.                                       |
| `boundaryCount`    | `1`            | Pages shown at each edge before an ellipsis.                                        |
| `hideFirstLast`    | `false`        | Omit the first/last jump controls.                                                  |
| `hidePreviousNext` | `false`        | Omit the previous/next controls.                                                    |
| `renderAs`         | `'buttons'`    | `'buttons'` (client state) or `'links'` (crawlable `<a href>`, needs `urlForPage`). |
| `urlForPage`       | `null`         | `(page) => string`; maps a page to its URL for links mode.                          |
| `totalItems`       | `null`         | Total item count; with `pageSize`, shows the "Showing X–Y of Z" readout.            |
| `pageSize`         | `null`         | Items per page; used to compute the readout range.                                  |
| `showJumpTo`       | `false`        | Show a jump-to-page number field.                                                   |
| `ariaLabel`        | `'Pagination'` | Accessible label for the navigation landmark.                                       |

## Headless

`et-pagination` applies the headless `etPagination` directive via `hostDirectives`.
Use the directive directly for a bespoke layout — it owns the `page` model and
exposes `items()` (the ordered `PaginationItem[]` of page numbers, jump controls
and ellipses) plus `goTo(page)` / `first()` / `previous()` / `next()` / `last()`.
The pure `paginate(options)` function is exported too, for computing the item list
outside Angular.

## Server data, query forms & tables

Derive `totalPages` from your list envelope's `totalPageCount` (or
`Math.ceil(totalHits / itemsPerPage)`), and bind `page` to your query state.
Because `page` is a two-way `model` and `(pageChange)` is exposed, wiring it to a
query source is a one-liner.

With the [table](/components/table)'s `tableRowsFromQuery` adapter:

```html
<et-table [data]="rows.rows()" [columns]="columns" sortMode="server" />
<et-pagination [page]="rows.page()" [totalPages]="totalPages()" (pageChange)="rows.setPage($event)" />
```

With the signals-first [QueryForm](/query/) (`page` becomes a query arg; changing
filters resets it via `isResetBy`):

```ts
const qf = createQueryForm({
  fields: { search: searchQueryField(), page: queryField<number>({ defaultValue: 1, isResetBy: ['search'] }) },
}).observe();
```

```html
<et-pagination
  [page]="qf.value().page ?? 1"
  [totalPages]="totalPages()"
  (pageChange)="qf.patchValue({ page: $event })"
/>
```

With the reactive-forms `QueryForm`, bind through the page control:

```html
<et-pagination [page]="page()" [totalPages]="totalPages()" (pageChange)="form.controls.page.setValue($event)" />
```

## Accessibility

The host is a `nav` landmark (`role="navigation"`, `aria-label`). Each control is a
real `<button>` (or `<a href>` in links mode) with a descriptive `aria-label`
("Page 3", "Previous page"); the current page sets `aria-current="page"`, and
unavailable controls (previous on the first page, etc.) are `disabled`. Each item is
a standard tab stop, so keyboard users move through them with Tab and activate with
Enter/Space (links also with the usual anchor semantics). Ellipses are inert and
`aria-hidden`; the readout is an `aria-live="polite"` region. On coarse pointers
(touch) the controls grow to a comfortable ~44px tap target, and when a large set
doesn't fit they wrap (rather than scrolling) so every control stays reachable.

## Theming

Colors come from the [`[et-button]`](/components/button) system: the current page is
a `filled` button (accent from the nearest color scope —
`--et-theme-color-primary` / `--et-theme-color-on-primary`), every other item is a
neutral `transparent` button that stays surface-themed until it's the active page
(`mutedUntilPressed`), with hover tints from `--et-surface-interaction-solid`. Size
and spacing are tunable via `--et-pagination-item-size`, `--et-pagination-gap` and
`--et-pagination-radius`; the buttons' own `--et-button-*` tokens are overridden for
the compact, square cells.
