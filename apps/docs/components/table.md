# Table

A type-safe, light-by-default data table. The row type flows from your data
through the column definitions into every cell, and the base table renders typed
rows on a CSS grid with a sticky header, an empty state, opt-in [sorting](#sorting)
and opt-in [filtering](#filtering). Row expansion, reordering, virtualization and
richer state persistence arrive as further features in later phases.

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

| Input        | Default     | Description                                                                               |
| ------------ | ----------- | ----------------------------------------------------------------------------------------- |
| `data`       | `[]`        | The rows to render.                                                                       |
| `columns`    | `[]`        | The column definitions from `tableColumns<T>()`.                                          |
| `rowKey`     | reference   | `(row: T) => string \| number` for stable change tracking (and later row-keyed state).    |
| `emptyLabel` | `'No data'` | Text shown when there are no rows and no `[etTableEmpty]` content is projected.           |
| `sort`       | `[]`        | Two-way bindable sort state — an ordered `{ key, direction }[]`. See [Sorting](#sorting). |
| `multiSort`  | `false`     | Allow more than one column to be sorted at once.                                          |
| `sortMode`   | `'client'`  | `'client'` sorts rows in the browser; `'server'` leaves them for the backend to sort.     |
| `filters`    | `[]`        | Two-way bindable filter state — `{ key, values }[]`. See [Filtering](#filtering).         |
| `filterMode` | `'client'`  | `'client'` filters rows in the browser; `'server'` leaves them for the backend to filter. |

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
| `align`         | `'start'`          | `'start' \| 'center' \| 'end'`.                                                                                         |
| `width`         | `'minmax(0, 1fr)'` | Any `grid-template-columns` track value (`'200px'`, `'minmax(120px, 1fr)'`, …).                                         |
| `hidden`        | `false`            | Hide the column initially; toggle later via table state.                                                                |

### Custom cells

Pass a `TemplateRef` as `cell`. The context gives you the row (`$implicit`), the
accessor's `value`, and the row `index`:

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

## Sticky header

The header row is `position: sticky`. It pins to the top of the **nearest
scroll container**, so wrap the table in a height-constrained scrollable element
to activate it:

```html
<div style="max-block-size: 320px; overflow: auto">
  <et-table [data]="rows()" [columns]="columns" />
</div>
```

## Empty state

When `data` is empty the table renders a single full-width row. Override the
default `emptyLabel` text by projecting `[etTableEmpty]` content:

```html
<et-table [data]="rows()" [columns]="columns">
  <div etTableEmpty>No results — try adjusting your filters.</div>
</et-table>
```

## Table state

`state()` is a serializable, versioned snapshot of column order and visibility;
`restoreState(state)` applies one back. This is the seed of the persistence
layer later phases build on (sort, filters, expanded/selected rows), and is
shaped to map onto server-side per-column config.

```ts
const snapshot = table.state(); // { v: 1, columns: [{ key, hidden }, …] }
table.restoreState(snapshot);
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
