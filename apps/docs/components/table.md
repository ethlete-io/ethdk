# Table

A type-safe, light-by-default data table. The row type flows from your data
through the column definitions into every cell, and the base table renders typed
rows on a CSS grid with a sticky header and an empty state. Choose its look with
[appearance & density](#appearance-density), fill cells with
[any content you like](#custom-cells), group columns under
[spanning headers](#grouped-headers), and turn on
[sorting](#sorting), [filtering](#filtering), [row expansion](#row-expansion),
[selection](#selection), [column reordering & visibility](#column-visibility-reordering)
and [virtualization](#virtualization) as needed.

```ts
import { TABLE_IMPORTS, tableColumns } from '@ethlete/components';
```

## Usage

Declare columns with `tableColumns<T>()` — binding the row type once makes every
`value` accessor typed against `T` — and pass them to `<et-table>`:

```ts
type User = { id: string; name: string; email: string; role: string };

@Component({
  imports: [TABLE_IMPORTS],
  template: `<et-table [data]="users()" [columns]="columns" />`,
})
export class UsersComponent {
  users = signal<User[]>([]);

  columns = tableColumns<User>([
    { key: 'name', header: 'Name', value: (user) => user.name },
    { key: 'email', header: 'Email', value: (user) => user.email },
    { key: 'role', header: 'Role', value: (user) => user.role },
  ]);
}
```

<StoryEmbed id="components-table--default" height="360px" />

The `key` is a stable identity used for state serialization (column order,
visibility — and later sort/filter); it never wires templates to data. The
typed `value` accessor is the only link between a column and the row.

## Inputs

| Input                 | Default      | Description                                                                                               |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `data`                | `[]`         | The rows to render.                                                                                       |
| `columns`             | `[]`         | The column definitions from `tableColumns<T>()`.                                                          |
| `rowKey`              | reference    | `(row: T) => string \| number` for stable change tracking (and later row-keyed state).                    |
| `appearance`          | `'enclosed'` | Visual frame: `'enclosed'`, `'divided'`, `'zebra'`, `'grid'`, `'bare'`. See [below](#appearance-density). |
| `density`             | `'md'`       | Cell padding: `'sm'` (tight), `'md'`, `'lg'` (roomy).                                                     |
| `emptyLabel`          | `'No data'`  | Text shown when there are no rows and no `[etTableEmpty]` content is projected.                           |
| `sort`                | `[]`         | Two-way bindable sort state — an ordered `{ key, direction }[]`. See [Sorting](#sorting).                 |
| `multiSort`           | `false`      | Allow more than one column to be sorted at once.                                                          |
| `sortMode`            | `'client'`   | `'client'` sorts rows in the browser; `'server'` leaves them for the backend to sort.                     |
| `filters`             | `[]`         | Two-way bindable filter state — `{ key, values }[]`. See [Filtering](#filtering).                         |
| `filterMode`          | `'client'`   | `'client'` filters rows in the browser; `'server'` leaves them for the backend to filter.                 |
| `expandedRowTemplate` | —            | Detail template; setting it enables [row expansion](#row-expansion). Context: `{ $implicit: row }`.       |
| `expandableRow`       | all rows     | `(row: T) => boolean` gating which rows can expand.                                                       |
| `expandedKeys`        | `new Set()`  | Two-way bindable set of expanded row keys (by `rowKey`).                                                  |
| `selectable`          | `false`      | Show a leading checkbox column for multi-row selection. See [Selection](#selection).                      |
| `selection`           | `new Set()`  | Two-way bindable set of selected row keys (by `rowKey`).                                                  |
| `selectableRow`       | all rows     | `(row: T) => boolean` gating which rows can be selected.                                                  |
| `reorderable`         | `false`      | Allow reordering columns by dragging their headers. See [below](#column-visibility-reordering).           |
| `virtualScroll`       | `false`      | Render only the rows near the viewport. See [Virtualization](#virtualization).                            |
| `estimateRowHeight`   | `48`         | Row height (px) assumed before a real row is measured — tune to your rows for a stable first paint.       |
| `overscan`            | `6`          | Rows kept rendered just outside the viewport on each side, to hide scroll flicker.                        |

## Appearance & density

Two independent presentation inputs. `appearance` is the frame; `density` is the
row rhythm. They compose with every feature.

```html
<et-table [data]="rows()" [columns]="columns" appearance="zebra" density="sm" />
```

<StoryEmbed id="components-table--appearance" height="360px" />

| `appearance` | Looks like                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------- |
| `enclosed`   | **Default.** Bordered, rounded surface panel with a tinted header band and subtle elevation. |
| `divided`    | Borderless; rows separated by hairline dividers. Sits flat inline in a page.                 |
| `zebra`      | Alternating row backgrounds; good for wide, scannable tables.                                |
| `grid`       | Full cell borders — spreadsheet density.                                                     |
| `bare`       | No chrome at all; hover only. For dashboards and cards.                                      |

`density` is `'md'` (default), `'sm'` (tight), or `'lg'` (roomy) — it sets the
`--et-table-cell-padding-block` / `--et-table-cell-padding-inline` custom properties,
which you can also override directly for a bespoke value.

The table is **its own scroll container**: give it a bounded height to scroll its
body with the header pinned (see [Sticky header](#sticky-header)), rather than
wrapping it in a scroller.

## Columns

Each entry of `tableColumns<T>()`:

| Field           | Default            | Description                                                                                                             |
| --------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `key`           | — (required)       | Stable, unique column identity for state. Duplicate keys throw [`ET3500`](/components/error-codes#table-et35xx) in dev. |
| `value`         | — (required)       | `(row: T) => V` — the typed cell accessor. Rendered directly unless `cell` is set.                                      |
| `sortable`      | `false`            | Render a sortable header for this column.                                                                               |
| `sortValue`     | `value`            | Comparable to sort by (`string`/`number`/`Date`/`boolean`/`null`) when the display value isn't comparable.              |
| `filterable`    | `false`            | Render a filter menu on this column's header.                                                                           |
| `filterOptions` | —                  | The `{ label, value }[]` choices — a static list or an async provider (see [below](#searchable-async-filter-options)).  |
| `filterSearch`  | `false`            | Add a search box to the filter menu.                                                                                    |
| `filterValue`   | `value`            | The value matched against the selected filter values, when the display value isn't the one to match on.                 |
| `header`        | —                  | Static header text. Ignored when `headerCell` is set.                                                                   |
| `cell`          | —                  | A `TemplateRef` for a custom cell. Context: `{ $implicit: row, value, index }`.                                         |
| `headerCell`    | —                  | A `TemplateRef` for a custom header. Context: `{ $implicit: header }`.                                                  |
| `footerCell`    | —                  | A `TemplateRef` for a footer/summary cell. Context: `{ $implicit: rows }`. See [Sticky footer](#sticky-columns-footer). |
| `group`         | —                  | Group label; adjacent columns sharing it span a header. See [Grouped headers](#grouped-headers).                        |
| `sticky`        | —                  | `'start' \| 'end'` — pin the column while scrolling horizontally. See [Sticky columns](#sticky-columns-footer).         |
| `align`         | `'start'`          | `'start' \| 'center' \| 'end'`.                                                                                         |
| `width`         | `'minmax(0, 1fr)'` | Any `grid-template-columns` track value (`'200px'`, `'minmax(120px, 1fr)'`, …).                                         |
| `hidden`        | `false`            | Hide the column initially; toggle later via table state.                                                                |

### Custom cells

A cell is whatever you put in a `TemplateRef` — text, avatars, badges, buttons,
charts, nested components. The table ships **no** opinionated cell components on
purpose: point a column's `cell` at your own template and compose the pieces you
already have. The context gives you the row (`$implicit`), the accessor's `value`,
and the row `index`:

```ts
@Component({
  template: `
    <et-table [data]="users()" [columns]="columns()" />
    <ng-template #roleCell let-value="value">
      <span class="badge">{{ value }}</span>
    </ng-template>
  `,
})
export class UsersComponent {
  roleCell = viewChild<TemplateRef<{ value: string }>>('roleCell');

  columns = computed(() =>
    tableColumns<User>([
      { key: 'name', header: 'Name', value: (u) => u.name },
      { key: 'role', header: 'Role', value: (u) => u.role, cell: this.roleCell() },
    ]),
  );
}
```

**Sort and filter still work on rich cells.** The display template is decoupled
from the values sorted/filtered on — set `sortValue` / `filterValue` on the column
so a cell that renders an avatar can still sort by name, or a badge by status.

#### Cookbook

Common cell shapes, each just a `cell` template. Compose the library's existing
components (`et-chip`, `et-button`, `et-menu`) rather than reaching for
table-specific ones:

```html
<!-- Avatar + two-line identity (whole row object as the value) -->
<ng-template #userCell let-user>
  <div class="flex items-center gap-2">
    <img [src]="user.avatarUrl" class="size-8 rounded-full" alt="" />
    <span class="flex flex-col leading-tight">
      <b>{{ user.name }}</b>
      <small class="opacity-70">{{ user.handle }}</small>
    </span>
  </div>
</ng-template>

<!-- Status badge — reuse the chip component -->
<ng-template #statusCell let-value="value">
  <et-chip [color]="value === 'active' ? 'success' : 'neutral'">{{ value }}</et-chip>
</ng-template>

<!-- Row actions — inline buttons (right-aligned via the column's align: 'end') -->
<ng-template #actionsCell let-user>
  <span class="flex gap-1">
    <button (click)="edit(user)" et-button variant="transparent" size="sm">Edit</button>
    <button [etMenuTrigger]="rowMenu" et-icon-button variant="transparent" size="sm" aria-label="More actions">
      <i etIcon="et-chevron"></i>
    </button>
  </span>
</ng-template>
```

```ts
columns = tableColumns<Player>([
  // sorts by name even though the cell renders an avatar + handle
  { key: 'player', header: 'Player', value: (p) => p, cell: userCell, sortValue: (p) => p.name },
  { key: 'status', header: 'Status', value: (p) => p.status, cell: statusCell, filterable: true },
  // right-align an actions column and give it a fixed width; pin it with sticky: 'end' if the table scrolls
  { key: 'actions', header: '', value: (p) => p, cell: actionsCell, align: 'end', width: '120px' },
]);
```

### Action cells

There's no `actionsColumn()` helper or built-in edit/delete components — a plain
`cell` template **is** the action-column API. Its context already carries
everything an action needs: the whole `row` (`$implicit`), the accessor `value`,
and the row `index`. Render your own [`[et-button]`](/components/button) /
[`et-menu`](/components/menu) and call your handlers directly. Right-align the
column with `align: 'end'` and give it a fixed `width`; pin it with `sticky: 'end'`
when the table scrolls horizontally.

Action cells **compose with [row navigation](#row-navigation)**: when the table is
`rowInteractive`, a click on any button, link, input or menu trigger inside a cell
is ignored by `(rowClick)` (it's detected via `composedPath`), so "Edit" fires its
own handler without also triggering row navigation — no `stopPropagation` needed.

## Grouped headers

Give columns a `group` and adjacent ones sharing it render beneath a single
spanning label in a second header row. Each sub-column stays a normal
column — independently [sortable](#sorting), [filterable](#filtering), reorderable.
Columns without a `group` span both header rows.

```ts
columns = tableColumns<Player>([
  { key: 'name', header: 'Name', value: (p) => p.name }, // ungrouped — spans both rows
  { key: 'gp', header: 'GP', value: (p) => p.gp, sortable: true, group: 'Season 24/25' },
  { key: 'pts', header: 'PTS', value: (p) => p.pts, sortable: true, group: 'Season 24/25' },
  { key: 'ast', header: 'AST', value: (p) => p.ast, sortable: true, group: 'Season 24/25' },
]);
```

<StoryEmbed id="components-table--grouped-headers" height="360px" />

Grouping follows the **visible column order**: a label spans each contiguous run
of columns that share it, so dragging a column out of a group (with `reorderable`)
simply splits the label into two runs — no separate group-move step. Both header
rows stay pinned when the table scrolls.

## Sorting

Mark columns `sortable` and the table renders sortable header buttons that cycle
**unsorted → ascending → descending → unsorted**, manage `aria-sort`, and drive
the two-way `sort` state (`{ key, direction }[]`):

```ts
columns = tableColumns<User>([
  { key: 'name', header: 'Name', value: (u) => u.name, sortable: true },
  // sort by a comparable when the display value isn't one:
  { key: 'joined', header: 'Joined', value: (u) => u.joinedLabel, sortValue: (u) => u.joinedAt, sortable: true },
]);
```

- **Client mode** (default) sorts rows in the browser. Nullish values always sink
  to the bottom. `multiSort` lets clicks layer multiple columns.
- **Server mode** (`sortMode="server"`) leaves rows untouched — read `sort()` and
  feed it into your query args (it maps directly onto the query form's sort field):

```html
<et-table [(sort)]="sort" [data]="users()" [columns]="columns" sortMode="server" />
```

The `sortRows({ rows, sort, columns })` helper the client mode uses is exported
and tree-shakable, for custom flows where you sort outside the table.

## Filtering

Mark columns `filterable` and give them `filterOptions`; the header renders a
filter menu (a multi-select checkbox list, built on [`menu`](/components/menu))
that drives the two-way `filters` state (`{ key, values }[]`):

```ts
columns = tableColumns<User>([
  { key: 'name', header: 'Name', value: (u) => u.name },
  {
    key: 'role',
    header: 'Role',
    value: (u) => u.role,
    filterable: true,
    filterOptions: [
      { label: 'Admin', value: 'admin' },
      { label: 'Editor', value: 'editor' },
    ],
  },
]);
```

- **Client mode** (default) filters rows in the browser: a row passes when, for
  every filtered column, its value is one of the selected values (AND across
  columns, OR within a column).
- **Server mode** (`filterMode="server"`) leaves rows untouched — read `filters()`
  and feed it into your query args.

The `filterRows({ rows, filters, columns })` helper is exported and tree-shakable.
Use `filterValue` when the value to match on differs from the displayed value.

### Searchable & async filter options

Set `filterSearch` to add a search box to the filter menu (client-side for a
static list). For **async, paginated options**, pass `filterOptions` as a
provider instead of an array — the exact shape
[`selectOptionsFromQuery`](/query/) already returns, so you can reuse it:

```ts
roleOptions = selectOptionsFromQuery({
  queryCreator: searchRoles,
  args: (query, page) => ({ queryParams: { q: query(), page: page() } }),
  toOptions: (res) => res.items.map((r) => ({ label: r.name, value: r.id })),
  toHasMore: (res) => res.hasMore,
});

columns = tableColumns<User>([
  { key: 'role', header: 'Role', value: (u) => u.role, filterable: true, filterOptions: this.roleOptions },
]);
```

The menu wires its search to the provider's `setQuery`, shows its `loading`, and
renders a **Load more** button when `hasMore` is true.

## Server-side rows (query)

`tableRowsFromQuery` feeds the table from an [`@ethlete/query`](/query/) query,
server-side — mirroring `selectOptionsFromQuery`. The query is created once and
re-executes reactively as sort/page change; pair it with `sortMode="server"` so
the backend does the sorting:

```ts
users = tableRowsFromQuery({
  queryCreator: getUsers,
  args: ({ sort, page }) => ({
    queryParams: { sortBy: sort()[0]?.key, sortOrder: sort()[0]?.direction, page: page() },
  }),
  toRows: (res) => res.items,
  toTotal: (res) => res.totalHits,
  toHasMore: (res) => res.hasMore,
});
```

```html
<et-table
  [data]="users.rows()"
  [columns]="columns"
  [sort]="users.sort()"
  (sortChange)="users.setSort($event)"
  sortMode="server"
/>
```

It returns `rows`, `loading`, `error`, `total`, `hasMore`, `sort`, `filters` and
`page` signals plus `setSort`/`setFilters`/`setPage` — the `args` builder reads
`sort`/`filters`/`page` to build the request. `rows` keeps the previous page visible
while the next one loads (no empty flash); `setSort`/`setFilters` reset to
`initialPage`. Pair with `sortMode="server"` and `filterMode="server"`. Call it from
a field initializer / constructor, like a query or query stack.

For the legacy `V2QueryClient`, use **`tableRowsFromV2Query`** — the same config
and return shape, backed by the legacy `queryComputed` container. Both adapters
share one client-agnostic core (`createTableRowsSource`), so they stay in lockstep.

## Row expansion

Provide an `expandedRowTemplate` and the table prepends an expander column; each
row toggles a **lazily-instantiated** full-width detail row (revealed with a
reduced-motion-aware height animation). Nest another `<et-table>` in the detail
template for **sub-tables**. Set `rowKey` so expansion state survives data
changes; gate rows with `expandableRow`.

```html
<et-table [data]="orders()" [columns]="columns" [rowKey]="orderId" [expandedRowTemplate]="detail" />

<ng-template #detail let-order>
  <!-- nest another table for a sub-table -->
  <et-table [data]="order.lines" [columns]="lineColumns" />
</ng-template>
```

`expandedKeys` is a two-way `Set` of row keys, so you can drive or persist which
rows are open. `isExpanded(row)` / `toggleExpanded(row)` are available on the
table instance.

## Selection

Set `selectable` and the table prepends a checkbox column. The header checkbox
selects or clears every selectable row (indeterminate when only some are), and
`selection` is a two-way `Set` of selected row keys — set a `rowKey` so selection
survives sorting, filtering and data changes.

```html
<et-table [(selection)]="selected" [data]="users()" [columns]="columns" [rowKey]="userId" [selectable]="true" />
```

Gate which rows can be selected with `selectableRow`. On the instance:
`isSelected(row)`, `setSelected(row, checked)`, `toggleAll()`, and the
`selectedRows()` / `isAllSelected()` / `isPartiallySelected()` signals. Select-all
and the "all/some" state consider only the rows currently in view (after
filtering), while `selection` keeps keys for filtered-out rows.

## Row navigation

Set `rowInteractive` to make whole rows respond to clicks: rows get a pointer
affordance and emit `(rowClick)` with the row. The table performs **no** navigation
itself — you wire it, keeping the SDK action-agnostic:

```html
<et-table [data]="orders()" [columns]="columns" [rowInteractive]="true" (rowClick)="open($event)" />
```

```ts
open(order: Order) {
  this.router.navigate(['/orders', order.id]);
}
```

Clicks that land on interactive cell content — a `<button>`, `<a>`, `<input>`,
`<select>`, a menu trigger, or the selection/expander cells — are ignored (detected
by walking `event.composedPath()`), so in-row controls and the row's own checkbox
keep working without also triggering navigation. Interactive rows are keyboard
focusable and activate on Enter/Space.

For crawlable, middle-click-friendly per-row links, prefer rendering a real `<a>` in
a cell over `(rowClick)` — a genuine link is better for SEO and accessibility;
`rowInteractive` is the convenience layer for the whole-row target.

## Sticky header

The table is its own scroll container, so you don't wrap it — just give it a
bounded height and the header row stays pinned (`position: sticky`) while the body
scrolls:

```html
<et-table [data]="rows()" [columns]="columns" style="block-size: 320px" />
```

## Sticky columns & footer

Pin columns to an edge with `sticky: 'start' | 'end'` — they stay put while the
table scrolls horizontally. Pin from the edges (leading columns to `'start'`,
trailing to `'end'`); give pinned columns explicit widths so the table has
something to scroll.

```ts
columns = tableColumns<User>([
  { key: 'name', header: 'Name', value: (u) => u.name, width: '220px', sticky: 'start' },
  { key: 'email', header: 'Email', value: (u) => u.email, width: '280px' },
  // …more columns…
  { key: 'actions', header: '', value: (u) => u, cell: actionsCell, width: '96px', sticky: 'end' },
]);
```

A column `footerCell` adds a **summary row pinned to the bottom** of the scroll
viewport. Its context is the rendered rows, so it can aggregate:

```ts
@Component({
  template: `
    <et-table [data]="orders()" [columns]="columns()" style="block-size: 24rem" />
    <ng-template #totalCell let-rows>{{ rows.length }} orders</ng-template>
    <ng-template #sumCell let-rows>{{ sum(rows) | currency }}</ng-template>
  `,
})
export class OrdersComponent {
  columns = computed(() =>
    tableColumns<Order>([
      { key: 'id', header: 'Order', value: (o) => o.id, footerCell: this.totalCell() },
      { key: 'total', header: 'Total', value: (o) => o.total, align: 'end', footerCell: this.sumCell() },
    ]),
  );
}
```

Any column with a `footerCell` shows the footer row; columns without one render an
empty footer cell. Both work with the other features — a pinned column's footer
cell is pinned in both directions.

## Pagination & page size

For controls that span the whole table — a paginator, a page-size picker — project
them into the **`[etTableFooter]` slot**. It renders a full-width bar below the grid,
pinned to the bottom of the table's scroll viewport (and only appears when you
actually project something). The table bakes in **no** pager; you drop in
[`<et-pagination>`](/components/pagination) and a page-size
[`<et-select>`](/components/select) and wire them to your data source.

With the `tableRowsFromQuery` adapter, bind the paginator's `page` / `(pageChange)`
to the adapter's `page` / `setPage`, and let the page-size select drive the query's
`limit`:

```ts
@Component({
  template: `
    <et-table [data]="rows.rows()" [columns]="columns" sortMode="server" style="block-size: 32rem">
      <div etTableFooter>
        <et-form-field>
          <et-select [formField]="pageSizeForm.pageSize" [clearable]="false" />
        </et-form-field>
        <et-pagination [page]="rows.page()" [totalPages]="totalPages()" (pageChange)="rows.setPage($event)" />
      </div>
    </et-table>
  `,
})
export class UsersComponent {
  rows = tableRowsFromQuery({ queryCreator, args, toRows, toTotal });
  pageSizeForm = form(signal({ pageSize: 20 }));
  totalPages = computed(() => Math.ceil((this.rows.total() ?? 0) / this.pageSizeForm.pageSize().value()));
}
```

The slot is layout-only: it's a flex row (`justify-content: space-between`) that
wraps on narrow tables. See the "Pagination & page size" story for a runnable
client-side example. For the paginator's own options (links mode, paged SEO, the
"Showing X–Y of Z" readout, jump-to-page), see the
[pagination guide](/components/pagination).

## Empty state

When `data` is empty the table renders a single full-width row. Override the
default `emptyLabel` text by projecting `[etTableEmpty]` content:

```html
<et-table [data]="rows()" [columns]="columns">
  <div etTableEmpty>No results — try adjusting your filters.</div>
</et-table>
```

## Column visibility & reordering

Set `reorderable` to let users **drag column headers** sideways to reorder them.
A floating ghost of the header follows the pointer and a drop indicator marks
where the column will land; the table itself doesn't move until you drop, and the
columns then animate into their new positions (respecting reduced-motion). It's
pure column-order state — no DOM surgery, since the grid re-lays-out from the
order.

Column **order and visibility** are also fully programmatic, so you can build a
"columns" chooser with the [menu](/components/menu):

| Method / signal                  | Description                     |
| -------------------------------- | ------------------------------- |
| `moveColumn(key, toIndex)`       | Move a column within the order. |
| `isColumnVisible(key)`           | Whether a column is shown.      |
| `setColumnVisible(key, visible)` | Show/hide a column.             |
| `toggleColumnVisibility(key)`    | Flip a column's visibility.     |

Both order and visibility are captured by [`state()`](#table-state) and restored
by `restoreState()`.

## Virtualization

For long lists, set `virtualScroll` so the table renders only the rows near the
viewport — a few dozen `<div role="row">`s stay in the DOM no matter how many
rows `data` holds, with block-padding spacers standing in for the rest so the
scrollbar still reflects the full count.

As always, the table is its own scroll container — give it a bounded height so the
window has a viewport to track:

```html
<et-table [data]="rows()" [columns]="columns" [virtualScroll]="true" style="block-size: 24rem" />
```

<StoryEmbed id="components-table--virtualized" height="440px" />

The sticky header pins to the table's own scroll container, so it keeps working.
Row heights are measured from a rendered row and assumed uniform; set
`estimateRowHeight` close to your real row height for the steadiest first paint,
and raise `overscan` if fast scrolling reveals blank rows before they render.

Virtualization composes with [row expansion](#row-expansion) — expanded rows
render within the window as you scroll to them. Because the window assumes a
uniform row height, lists where many rows are expanded at once scroll most
smoothly when expanded content is modest.

## Table state

`state()` is a serializable, versioned snapshot of the table's configurable
state — column **order**, **visibility**, **sort** and **filters** (per column),
plus **expanded rows**. `restoreState(state)` applies one back. The two round-trip
losslessly, so it's the basis for persisting and sharing a table setup.

```ts
const snapshot = table.state();
// {
//   v: 1,
//   columns: [
//     { key: 'name', hidden: false, sort: 'asc' },
//     { key: 'role', hidden: true, filterValues: ['Admin'] },
//   ],
//   expanded: ['42'], // present only when a rowKey is set
// }
table.restoreState(snapshot);
```

The per-column shape maps 1:1 onto typical server-side list-view config (`hidden`,
sort direction, `filterValues`), so bridging to a backend is mechanical. With
`multiSort`, each sorted column also carries a `sortPriority` so the sort order
survives the round-trip. Expanded rows serialize by their `rowKey` — set a
[`rowKey`](#inputs) for expansion to be captured.

### Restore a table from a link

`serializeTableState()` / `deserializeTableState()` turn a snapshot into a string
you can put in a URL query param (and back), so a filtered, sorted, reordered
table is shareable as a link. Deserialize returns `null` for an absent, malformed
or unknown-version value, so a stale link just falls back to the default view.

```ts
import { deserializeTableState, serializeTableState } from '@ethlete/components';

@Component({
  template: `<et-table #table [data]="rows()" [columns]="columns" />`,
})
export class UsersComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  table = viewChild.required<TableComponent<User>>('table');

  constructor() {
    // Restore from the URL on load.
    const restored = deserializeTableState(this.route.snapshot.queryParamMap.get('table'));
    if (restored) afterNextRender(() => this.table().restoreState(restored));

    // Reflect changes back into the URL (the router encodes the value).
    effect(() => {
      const table = serializeTableState(this.table().state());
      this.router.navigate([], { queryParams: { table }, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }
}
```

## Accessibility

The table uses the ARIA grid pattern: `role="grid"` on the container, `role="row"`
on each row, `role="columnheader"` on header cells and `role="gridcell"` on body
cells. Sortable headers are real `<button>`s (keyboard-operable) and set
`aria-sort` on their column header. Full grid keyboard navigation arrives with the
later interactive features.

## Theming

Colors come from the [surface theming](/core/theming) tokens of the nearest
surface scope — header/body text from `--et-surface-color-*-solid`, separators
from `--et-surface-border-solid`, and the row hover tint from
`--et-surface-interaction-solid`. Cell padding is tunable via the
`--et-table-cell-padding-block` / `--et-table-cell-padding-inline` custom
properties.

## Error codes

See [`ET35xx`](/components/error-codes#table-et35xx).
