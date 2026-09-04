# Pagination

A page-number paginator: first / previous / next / last jump controls around a
window of page numbers, with `…` ellipses for large page counts. Signals-first -
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

<StoryEmbed id="components-navigation-pagination--default" height="200px" />

For large counts, far pages collapse behind ellipses around the current page and
each edge (`1 … 45 46 47 … 200`):

<StoryEmbed id="components-navigation-pagination--many-pages" height="200px" />

## Range readout & jump-to-page

Pass `totalItems` **and** `pageSize` to show a "Showing X–Y of Z" readout, and set
`showJumpTo` for a number field that jumps straight to a page - both handy for
large result sets. A `page` past the end (a filter just shrank the set) reads as the last
page, the same way the page numbers clamp it.

```html
<et-pagination [(page)]="page" [totalPages]="totalPages()" [totalItems]="total()" [pageSize]="20" showJumpTo />
```

<StoryEmbed id="components-navigation-pagination--with-range-and-jump" height="220px" />

Both readouts (this one and the compact pager's) **reserve the width of the widest
text they can ever produce** and use tabular figures, so stepping 9 → 10 doesn't
widen them and shove whatever is laid out beside the paginator sideways.

## Page size

`<et-page-size-select>` is the "Items per page" control that completes the Material-style
controls row. Import `PAGE_SIZE_SELECT_IMPORTS`:

```html
<div class="controls-row">
  <et-page-size-select [(pageSize)]="pageSize" size="sm" />
  <et-pagination [(page)]="page" [totalPages]="totalPages()" [totalItems]="total()" [pageSize]="pageSize()" compact />
</div>
```

<StoryEmbed id="components-navigation-pagination--page-size-select" height="220px" />

It is a **native `<select>`**. A handful of numbers doesn't justify dragging the overlay
runtime and [`et-select`](/components/select)'s panel into every footer that shows one, and
on mobile the platform picker is the better control at this size anyway. It costs nothing
beyond itself.

It is a **separate component**, not part of the paginator, because the paginator owns `page`
and page size is yours - a table footer, an infinite list and a gallery all pair them
differently, and plenty of paginators want no size control at all. Lay the two out however
your app wants; both take `size="sm"` so they shrink together.

| Input      | Type                | Default             | What it does                                             |
| ---------- | ------------------- | ------------------- | -------------------------------------------------------- |
| `pageSize` | `number` (model)    | required            | The current size; picking a choice writes it back        |
| `sizes`    | `readonly number[]` | `[10, 25, 50, 100]` | The choices offered                                      |
| `size`     | `'sm' \| 'md'`      | `'md'`              | Density, to match the paginator beside it                |
| `labels`   | `Partial<…>`        | `null`              | Per-instance strings - see [Localization](#localization) |

Its height is its own token, `--et-page-size-select-height` (default `36px`, `44px` on a
coarse pointer) - not the paginator's `--et-pagination-item-size`, so it can follow its own
density without also resizing the paginator wherever the two aren't paired.

### Changing the size does not reset the page

Which page 1-based position 47 belongs to depends on what you're paging, so that decision
stays yours. Going back to page 1 is the usual answer, and `linkedSignal` is one line:

```ts
protected pageSize = signal(25);
// page 1 whenever the size changes; the paginator drives it the rest of the time
protected page = linkedSignal<number, number>({ source: this.pageSize, computation: () => 1 });
```

## Localization

Every string the paginator renders itself - the control `aria-label`s ("Previous
page", "Page 3"), the "Showing X–Y of Z" readout, the compact pager's readout, the
jump-to-page label, the page-size select's label and the landmark's `aria-label` -
comes from one label set,
English by default. Localize it once per app (or per lazy-loaded feature) with
`providePaginationLabels`; anything you leave out keeps its English default.

```ts
import { providePaginationLabels } from '@ethlete/components';

bootstrapApplication(AppComponent, {
  providers: [
    providePaginationLabels({
      navigation: 'Seitennavigation',
      first: 'Erste Seite',
      previous: 'Vorherige Seite',
      next: 'Nächste Seite',
      last: 'Letzte Seite',
      page: (page) => `Seite ${page}`,
      range: ({ start, end, totalItems }) => `Zeige ${start}–${end} von ${totalItems}`,
      compactRange: ({ start, end, totalItems }) => `${start}–${end} von ${totalItems}`,
      jumpTo: 'Gehe zu Seite',
      pageSize: 'Einträge pro Seite',
    }),
  ],
});
```

The `labels` input overrides the provided set for a single paginator - use it for a
one-off wording, not for translation:

```html
<et-pagination [(page)]="page" [totalPages]="totalPages()" [labels]="{ next: 'Weiter' }" />
```

<StoryEmbed id="components-navigation-pagination--localized" height="240px" />

The label keys, all optional:

| Key              | Default                        | Where it shows                                                          |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `navigation`     | `'Pagination'`                 | The landmark's `aria-label` (unless `ariaLabel` is set).                |
| `first`          | `'First page'`                 | `aria-label` of the jump-to-first control.                              |
| `previous`       | `'Previous page'`              | `aria-label` of the previous control.                                   |
| `next`           | `'Next page'`                  | `aria-label` of the next control.                                       |
| `last`           | `'Last page'`                  | `aria-label` of the jump-to-last control.                               |
| `ellipsis`       | `'More pages'`                 | `aria-label` for a gap (inert here; for custom renderings).             |
| `page`           | `` (page) => `Page ${page}` `` | `aria-label` of a page item; also gets `totalPages`.                    |
| `range`          | `'Showing 41–60 of 500'`       | The `totalItems`/`pageSize` readout; gets `{ start, end, totalItems }`. |
| `compactRange`   | `'41–60 of 500'`               | The compact pager's readout when the range is known.                    |
| `compactPage`    | `'3 / 25'`                     | The compact pager's readout without `totalItems`/`pageSize`.            |
| `jumpTo`         | `'Go to page'`                 | Label of the `showJumpTo` field.                                        |
| `pageSize`       | `'Items per page'`             | Visible label of `<et-page-size-select>`.                               |
| `pageSizeOption` | `` (size) => `${size}` ``      | One page-size choice - override for `'All'` or `'25 per page'`.         |

`ariaLabel` still wins over `navigation` - set it when two paginators share a page
("Search results pages" vs "Comments pages"), and translate that string yourself.

The pure `paginate()` function takes the same overrides as a `labels` option, so item
labels are localized outside Angular too.

## Links mode & SEO

By default items are `<button>`s (pure client state). For crawlable pagination,
set `renderAs="links"` and provide a `urlForPage` mapping - items render as real
`<a href>`s. Plain left-clicks are intercepted (no full reload) so the `page` model
still drives everything; modified clicks (⌘/Ctrl/Shift/middle) open the URL as the
browser normally would.

```html
<et-pagination [(page)]="page" [totalPages]="totalPages()" [urlForPage]="urlForPage" renderAs="links" />
```

```ts
urlForPage = (page: number) => `/results?page=${page}`;
```

<StoryEmbed id="components-navigation-pagination--links" height="200px" />

For paged SEO - a per-page canonical link plus `rel="prev"`/`rel="next"` - add the
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

| Input              | Default     | Description                                                                         |
| ------------------ | ----------- | ----------------------------------------------------------------------------------- |
| `page`             | `1`         | The current page (1-based). Two-way bindable.                                       |
| `totalPages`       | `1`         | Total number of pages.                                                              |
| `siblingCount`     | `1`         | Pages shown on each side of the current page.                                       |
| `boundaryCount`    | `1`         | Pages shown at each edge before an ellipsis.                                        |
| `hideFirstLast`    | `false`     | Omit the first/last jump controls.                                                  |
| `hidePreviousNext` | `false`     | Omit the previous/next controls.                                                    |
| `responsive`       | `true`      | Auto-fit the page window to the available width (see below).                        |
| `compact`          | `null`      | Force the compact prev/next pager on/off; `null` leaves it to `responsive` width.   |
| `size`             | `'md'`      | `'sm'` shrinks the items for tight spots like a mobile table footer.                |
| `renderAs`         | `'buttons'` | `'buttons'` (client state) or `'links'` (crawlable `<a href>`, needs `urlForPage`). |
| `urlForPage`       | `null`      | `(page) => string`; maps a page to its URL for links mode.                          |
| `totalItems`       | `null`      | Total item count; with `pageSize`, shows the "Showing X–Y of Z" readout.            |
| `pageSize`         | `null`      | Items per page; used to compute the readout range.                                  |
| `showJumpTo`       | `false`     | Show a jump-to-page number field.                                                   |
| `labels`           | `null`      | Per-instance string overrides, merged over the provided set (see Localization).     |
| `ariaLabel`        | `null`      | Landmark label; `null` uses the label set's `navigation` string.                    |

## Responsive window

With `responsive` on (the default), the paginator adapts to **its own measured
width** - not a viewport media query, so it reacts to the space it actually sits
in (a sidebar, a table footer, a modal). As width shrinks it first trims the page
window to fit one row - shedding sibling pages, then the first/last jumps
(`siblingCount`/`boundaryCount` act as the _desired_ maximum; it only ever shows
that many or fewer). Once the width is too tight for a useful number row, it
**collapses to a compact pager**. Set `responsive="false"` to always render the
full configured number row.

The compact pager is a range readout followed by previous/next - the item range
("1–10 of 40") when `totalItems`/`pageSize` are set, otherwise the page position -
with the readout _before_ the chevrons, and its width reserved for the longest range
it can show, so the controls hold their position across page changes. `hidePreviousNext`
applies here too, leaving the readout on its own. Because auto-collapse measures
the paginator's own box, give it a definite
width where it would otherwise shrink to its content (e.g. a flex item) - stretch it
(`w-full`, `flex: 1`). Or skip measurement entirely with `[compact]="true"` for a
Material-style controls row where the paginator sits inline with a page-size select:

```html
<div class="flex items-center justify-end gap-3">
  <span>Items per page:</span>
  <et-form-field appearance="underline" size="sm">
    <et-select [formField]="pageSize" [clearable]="false"> … </et-select>
  </et-form-field>
  <et-pagination [(page)]="page" [totalPages]="totalPages()" [totalItems]="total()" [pageSize]="20" [compact]="true" />
</div>
```

The `size="sm"` input independently shrinks the number-row items for explicit
compact layouts.

## Headless

`et-pagination` applies the headless `etPagination` directive via `hostDirectives`.
Use the directive directly for a bespoke layout - it owns the `page` model and
exposes `items()` (the ordered `PaginationItem[]` of page numbers, jump controls
and ellipses - labels already localized) plus `resolvedLabels()` for your own
readouts, and `goTo(page)` / `first()` / `previous()` / `next()` / `last()`.
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
const qf = defineQueryForm({
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
("Page 3", "Previous page" - all [localizable](#localization)); the current page sets `aria-current="page"`, and
unavailable controls (previous on the first page, etc.) are `disabled`. Each item is
a standard tab stop, so keyboard users move through them with Tab and activate with
Enter/Space (links also with the usual anchor semantics). Ellipses are inert and
`aria-hidden`; the readout is an `aria-live="polite"` region. On coarse pointers
(touch) the default density grows to a comfortable 44px tap target - and the
page-size select with it, so the two stay level; `size="sm"` (28px) and the compact
pager (34px) keep their tighter floors on purpose, for the tight spots they exist
for. When a large set doesn't fit, the controls wrap (rather than scrolling) so
every one stays reachable.

## Theming

Colors come from the [`[et-button]`](/components/button) system: the current page is
a `filled` button (accent from the nearest color scope -
`--et-theme-color-primary` / `--et-theme-color-on-primary`), every other item is a
neutral `transparent` button that takes its colors from the surface until it's the
active page (`color="surface"`). Size
and spacing are tunable via `--et-pagination-item-size`, `--et-pagination-gap` and
`--et-pagination-radius`; the buttons' own `--et-button-*` tokens are overridden for
the compact, square cells.
