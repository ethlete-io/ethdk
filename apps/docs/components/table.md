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
import { TABLE_IMPORTS, TableColumns } from '@ethlete/components';
```

## Opt-in features

`TABLE_IMPORTS` is deliberately lean: typed rows and cells, sort headers, sticky
columns, the empty state and the footer slot. Anything that would drag a heavier
dependency in ships as its own directive — import its array and put the attribute on
the table. A table that doesn't import a feature never pays for its code.

| Feature             | Import                             | Attribute                   | Brings in                                            |
| ------------------- | ---------------------------------- | --------------------------- | ---------------------------------------------------- |
| Filter menus        | `TABLE_FILTER_IMPORTS`             | `etTableFilters`            | the [menu](/components/menu) system                  |
| Column menu         | `TABLE_COLUMN_MENU_IMPORTS`        | `etTableColumnMenu`         | the [menu](/components/menu) system                  |
| Column chooser      | `TABLE_COLUMN_CHOOSER_IMPORTS`     | `<et-table-column-chooser>` | the [menu](/components/menu) system                  |
| Column resize       | `TABLE_RESIZE_IMPORTS`             | `etTableResize`             | the drag primitives                                  |
| Column reorder      | `TABLE_REORDER_IMPORTS`            | `etTableReorder`            | the drag primitives                                  |
| Row selection       | `TABLE_SELECTION_IMPORTS`          | `etTableSelection`          | the [checkbox](/components/choice-inputs)            |
| Virtual scroll      | `TABLE_VIRTUAL_SCROLL_IMPORTS`     | `etTableVirtualScroll`      | the virtual-window utility                           |
| Cell error tooltip  | `TABLE_CELL_ERROR_TOOLTIP_IMPORTS` | `etTableCellErrorTooltip`   | the [tooltip](/components/tooltip) + overlay runtime |
| State persistence   | `TABLE_STATE_PERSISTENCE_IMPORTS`  | `etTableStatePersistence`   | nothing (local/session storage)                      |
| CSV export          | `TABLE_CSV_EXPORT_IMPORTS`         | `etTableCsvExport`          | nothing (a pure serializer)                          |
| Keyboard navigation | `TABLE_KEYBOARD_NAV_IMPORTS`       | `etTableKeyboardNav`        | nothing                                              |
| Inline cell editing | `TABLE_INLINE_EDIT_IMPORTS`        | `etTableInlineEdit`         | nothing (the editor is your own control)             |

```html
<et-table [data]="rows()" [columns]="COLUMNS" etTableFilters etTableResize />
```

Each feature takes its options as a single object, so nothing competes with the table's
own input names, and every one accepts `enabled` to switch it off at runtime (a directive
can't be applied conditionally):

```html
<et-table
  [data]="rows()"
  [columns]="COLUMNS"
  [etTableResize]="{ enabled: canResize() }"
  [etTableVirtualScroll]="{ estimateRowHeight: 52 }"
/>
```

Features register themselves with the table, and the serializable state they drive
(filter values, column widths) lives on the table — so
[`state()` / `restoreState()`](#table-state) round-trip it whether or not the feature is
imported. Sorting, row expansion, sticky columns, the footer slot and the empty state are
part of the base: they cost nothing beyond the table itself.

## Usage

Declare the columns as a record keyed by column key, checked with
`satisfies TableColumns<T>` — that binds the row type once, so every `value` accessor is
typed against `T`, and each column's key is the key it is declared under:

```ts
type User = { id: string; name: string; email: string; role: string };

@Component({
  imports: [TABLE_IMPORTS],
  template: `<et-table [data]="users()" [columns]="COLUMNS" />`,
})
export class UsersComponent {
  protected users = signal<User[]>([]);

  protected readonly COLUMNS = {
    name: { header: 'Name', value: (user) => user.name },
    email: { header: 'Email', value: (user) => user.email },
    role: { header: 'Role', value: (user) => user.role },
  } satisfies TableColumns<User>;
}
```

<StoryEmbed id="components-table--default" height="360px" />

A column's key is a stable identity used for state serialization (column order,
visibility, sort, filters, width) and for matching [cell templates](#custom-cells) to
their column. The typed `value` accessor is the only link between a column and the row —
nothing is wired by string.

Keep the record a plain `readonly` field (or a module-level `const`) where you can. It
may be a `computed()` when the definitions really depend on other state; the table
reconciles a user's column order, widths and hidden columns across such a change rather
than resetting them.

## Inputs

| Input                 | Default      | Description                                                                                                     |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| `data`                | `[]`         | The rows to render.                                                                                             |
| `columns`             | `{}`         | The column definitions, keyed by column key — see [Columns](#columns).                                          |
| `rowKey`              | reference    | `(row: T) => string \| number` for stable change tracking (and later row-keyed state).                          |
| `appearance`          | `'enclosed'` | Visual frame: `'enclosed'`, `'divided'`, `'zebra'`, `'grid'`, `'bare'`. See [below](#appearance-density).       |
| `density`             | `'md'`       | Cell padding: `'sm'` (tight), `'md'`, `'lg'` (roomy).                                                           |
| `labels`              | injected set | Partial wording override for this table — see [Localization](#localization).                                    |
| `emptyTemplate`       | —            | Template for the empty state. Context: `{ $implicit: rows }`.                                                   |
| `loading`             | `false`      | Placeholder rows when there are no rows yet, a busy bar over existing ones. See [below](#loading-error-states). |
| `loadingRows`         | `5`          | How many placeholder rows to draw while loading with no rows.                                                   |
| `error`               | `null`       | Anything non-nullish replaces the body with the error state.                                                    |
| `errorTemplate`       | —            | Template for the error state. Context: `{ $implicit: error }`.                                                  |
| `cellState`           | —            | `(row: T, key: string) => 'loading' \| 'error' \| null` for [per-cell states](#per-cell-states).                |
| `sort`                | `[]`         | Two-way bindable sort state — an ordered `{ key, direction }[]`. See [Sorting](#sorting).                       |
| `multiSort`           | `false`      | Allow more than one column to be sorted at once.                                                                |
| `sortMode`            | `'client'`   | `'client'` sorts rows in the browser; `'server'` leaves them for the backend to sort.                           |
| `filters`             | `[]`         | Two-way bindable filter state — `{ key, values }[]`. See [Filtering](#filtering).                               |
| `filterMode`          | `'client'`   | `'client'` filters rows in the browser; `'server'` leaves them for the backend to filter.                       |
| `expandedRowTemplate` | —            | Detail template; setting it enables [row expansion](#row-expansion). Context: `{ $implicit: row }`.             |
| `expandableRow`       | all rows     | `(row: T) => boolean` gating which rows can expand.                                                             |
| `expandedKeys`        | `new Set()`  | Two-way bindable set of expanded row keys (by `rowKey`).                                                        |
| `rowInteractive`      | `false`      | Make rows clickable, emitting `(rowClick)`. See [Row navigation](#row-navigation).                              |

## Appearance & density

Two independent presentation inputs. `appearance` is the frame; `density` is the
row rhythm. They compose with every feature.

```html
<et-table [data]="rows()" [columns]="COLUMNS" appearance="zebra" density="sm" />
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

Each value of the `TableColumns<T>` record:

| Field           | Default               | Description                                                                                                            |
| --------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `value`         | — (required)          | `(row: T) => V` — the typed cell accessor. Rendered directly unless an `etTableCell` template is registered.           |
| `sortable`      | `false`               | Render a sortable header for this column.                                                                              |
| `sortValue`     | `value`               | Comparable to sort by (`string`/`number`/`Date`/`boolean`/`null`) when the display value isn't comparable.             |
| `filterable`    | `false`               | Render a filter menu on this column's header.                                                                          |
| `filterOptions` | —                     | The `{ label, value }[]` choices — a static list or an async provider (see [below](#searchable-async-filter-options)). |
| `filterSearch`  | `false`               | Add a search box to the filter menu.                                                                                   |
| `filterValue`   | `value`               | The value matched against the selected filter values, when the display value isn't the one to match on.                |
| `header`        | —                     | Static header text. Ignored when an `etTableHeaderCell` template is registered.                                        |
| `group`         | —                     | Group label; adjacent columns sharing it span a header. See [Grouped headers](#grouped-headers).                       |
| `sticky`        | —                     | `'start' \| 'end'` — pin the column while scrolling horizontally. See [Sticky columns](#sticky-columns-footer).        |
| `align`         | `'start'`             | `'start' \| 'center' \| 'end'`.                                                                                        |
| `width`         | `'minmax(48px, 1fr)'` | Any `grid-template-columns` track value (`'200px'`, `'minmax(120px, 1fr)'`, …). See the notes below.                   |
| `hidden`        | `false`               | Hide the column initially; toggle later via table state.                                                               |

**Every column has a floor**, `minWidth` (96px by default), and it applies whether the
column is squeezed by a wider neighbour or dragged there by a
[resize](#resizable-columns) — one number, so the two can't disagree. It's sized to
keep the header readable: a cell spends 24px on its own inline padding and up to
another 24px on a [column-menu](#column-menu) trigger, so much less than this is all
chrome and no label. Lower it per column where that's genuinely fine:

```ts
status: { header: '', value: (o) => o.status, minWidth: 40 },
```

Past the floor the table scrolls horizontally rather than squeezing further, which the
edge gradients advertise. **A flexible `width` you write yourself needs its own floor**
— a bare `1fr` or `minmax(0, 2fr)` overrides `minWidth` and can be squeezed to
nothing, at which point the cell's padding bursts out of the empty track and columns
visibly overlap. Prefer `minmax(96px, 2fr)`.

Leave at least one column flexible (`fr` or `auto`) if you can — a flexible track is
what lets the grid fill its container exactly. If every column ends up a rigid
length (declaring them all in px, or a user resizing them all), the table adds a
trailing slack track carrying an empty cell per row, so the header band, dividers
and rules still run to the panel's edge. The exception is a table with an
[end-pinned column](#sticky-columns-footer), which already owns that edge.

### Custom cells

A cell is whatever you put in an `<ng-template>` — text, avatars, badges, buttons,
charts, nested components. The table ships **no** opinionated cell components on
purpose: write your own template inside the table, bind it to the column it renders,
and compose the pieces you already have.

Binding the **column object** is what types the template: `let-row` is your row type
and `let-value` the column's `value` type — inferred, not declared.

```ts
@Component({
  imports: [TABLE_IMPORTS],
  template: `
    <et-table [data]="users()" [columns]="COLUMNS">
      <ng-template [etTableCell]="COLUMNS.role" let-row let-value="value">
        <span class="badge">{{ value }}</span>
      </ng-template>
    </et-table>
  `,
})
export class UsersComponent {
  protected readonly COLUMNS = {
    name: { header: 'Name', value: (user) => user.name },
    role: { header: 'Role', value: (user) => user.role },
  } satisfies TableColumns<User>;
}
```

Three template directives, each matched to its column the same way:

| Directive             | Renders                          | Context                                                                       |
| --------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `etTableCell`         | the column's body cells          | `let-row` (the row), `let-value="value"`, `let-i="index"`                     |
| `etTableHeaderCell`   | the column's header cell         | `let-header` — the column's `header` text                                     |
| `etTableFooterCell`   | the column's footer/summary cell | `let-rows` — every rendered row. See [Sticky footer](#sticky-columns-footer). |
| `etTableCellSkeleton` | the column's cells while loading | `let-index`, `let-width`. See [Loading](#loading-error-states).               |

A template bound to a column the table doesn't render throws
[`ET3504`](/components/error-codes#table-et35xx) in dev, so a typo can't silently render
nothing. A template inside a control-flow block registers and unregisters with that
block, so `@if` around one turns that cell off.

**Sort and filter still work on rich cells.** The display template is decoupled
from the values sorted/filtered on — set `sortValue` / `filterValue` on the column
so a cell that renders an avatar can still sort by name, or a badge by status.

#### Cookbook

Common cell shapes. Compose the library's existing components (`et-chip`,
`et-button`, `et-menu`) rather than reaching for table-specific ones:

```html
<et-table [data]="players()" [columns]="COLUMNS">
  <!-- Avatar + two-line identity (the whole row object is this column's value) -->
  <ng-template [etTableCell]="COLUMNS.player" let-player>
    <div class="flex items-center gap-2">
      <img [src]="player.avatarUrl" class="size-8 rounded-full" alt="" />
      <span class="flex flex-col leading-tight">
        <b>{{ player.name }}</b>
        <small class="opacity-70">{{ player.handle }}</small>
      </span>
    </div>
  </ng-template>

  <!-- Status badge — reuse the chip component -->
  <ng-template [etTableCell]="COLUMNS.status" let-value="value">
    <et-chip [color]="value === 'active' ? 'success' : 'neutral'">{{ value }}</et-chip>
  </ng-template>

  <!-- Row actions — inline buttons (right-aligned via the column's align: 'end') -->
  <ng-template [etTableCell]="COLUMNS.actions" let-player>
    <span class="flex gap-1">
      <button (click)="edit(player)" et-button variant="transparent" size="sm">Edit</button>
      <button [etMenuTrigger]="rowMenu" et-icon-button variant="transparent" size="sm" aria-label="More actions">
        <i etIcon="et-chevron"></i>
      </button>
    </span>
  </ng-template>
</et-table>
```

```ts
protected readonly COLUMNS = {
  // sorts by name even though the cell renders an avatar + handle
  player: { header: 'Player', value: (player) => player, sortValue: (player) => player.name },
  status: { header: 'Status', value: (player) => player.status, filterable: true },
  // right-align an actions column and give it a fixed width; pin it with sticky: 'end' if the table scrolls
  actions: { header: '', value: (player) => player, align: 'end', width: '120px' },
} satisfies TableColumns<Player>;
```

### Action cells

There's no `actionsColumn()` helper or built-in edit/delete components — a plain
`etTableCell` template **is** the action-column API. Its context already carries
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
protected readonly COLUMNS = {
  name: { header: 'Name', value: (p) => p.name },
  gp: { header: 'GP', value: (p) => p.gp, sortable: true, group: 'Season 24/25' },
  pts: { header: 'PTS', value: (p) => p.pts, sortable: true, group: 'Season 24/25' },
  ast: { header: 'AST', value: (p) => p.ast, sortable: true, group: 'Season 24/25' },
} satisfies TableColumns<Player>;
```

<StoryEmbed id="components-table--grouped-headers" height="360px" />

Grouping follows the **visible column order**: a label spans each contiguous run
of columns that share it, so dragging a column out of a group (with `reorderable`)
simply splits the label into two runs — no separate group-move step. Both header
rows stay pinned when the table scrolls.

## Sorting

Mark columns `sortable` and the **header itself becomes the sort control** — click it
to cycle **unsorted → ascending → descending → unsorted**. It manages `aria-sort` and
drives the two-way `sort` state (`{ key, direction }[]`):

```ts
protected readonly COLUMNS = {
  name: { header: 'Name', value: (u) => u.name, sortable: true },
  joined: { header: 'Joined', value: (u) => u.joinedLabel, sortValue: (u) => u.joinedAt, sortable: true },
} satisfies TableColumns<User>;
```

The only sort affordance is an accented arrow beside the label showing the direction
the column is sorted by; an unsorted header is just its label, with nothing reserving
space. For explicit "sort ascending / descending / clear" entries, add the
[column menu](#column-menu). `setSort(key, direction | null)` does the same
programmatically, without `toggleSort`'s cycle.

- **Client mode** (default) sorts rows in the browser. Nullish values always sink
  to the bottom. `multiSort` lets clicks layer multiple columns.
- **Server mode** (`sortMode="server"`) leaves rows untouched — read `sort()` and
  feed it into your query args (it maps directly onto the query form's sort field):

```html
<et-table [(sort)]="sort" [data]="users()" [columns]="COLUMNS" sortMode="server" />
```

The `sortRows({ rows, sort, columns })` helper the client mode uses is exported
and tree-shakable, for custom flows where you sort outside the table.

## Filtering

Filter menus are **opt-in**: they carry the whole [`menu`](/components/menu) system, so
they live in a separate component rather than in the base table. Import
`TABLE_FILTER_IMPORTS` and put `etTableFilters` on the table — a table
without it never pulls the menu into your bundle.

```ts
import { TABLE_FILTER_IMPORTS, TABLE_IMPORTS } from '@ethlete/components';
```

```html
<et-table [data]="users()" [columns]="COLUMNS" etTableFilters />
```

Then mark columns `filterable` and give them `filterOptions`; each such header renders a
filter menu (a multi-select checkbox list) that drives the two-way `filters` state
(`{ key, values }[]`). Filter state lives on the table itself, so `state()` /
`restoreState()` round-trip filter values whether or not the feature is imported:

```ts
protected readonly COLUMNS = {
  name: { header: 'Name', value: (u) => u.name },
  role: {
    header: 'Role',
    value: (u) => u.role,
    filterable: true,
    filterOptions: [
      { label: 'Admin', value: 'admin' },
      { label: 'Editor', value: 'editor' },
    ],
  },
} satisfies TableColumns<User>;
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

protected readonly COLUMNS = {
  role: { header: 'Role', value: (u) => u.role, filterable: true, filterOptions: this.roleOptions },
} satisfies TableColumns<User>;
```

The menu wires its search to the provider's `setQuery`, shows its `loading`, and
renders a **Load more** button when `hasMore` is true. (A provider implies a search box
even without `filterSearch`.) Its strings — the search placeholder, "no options", "Load
more" — live in the table's [label set](#localization).

### One value or several

A column filters by many values by default (a checkbox menu). Give it
`filterSelection: 'single'` and the menu renders radio items instead: picking replaces the
selection, and picking the selected option again clears the filter — the only way out of a radio
group, which has no "none" row. Filter state stays a list of values either way, so client
filtering, `state()` and a server request are unchanged.

```ts
protected readonly COLUMNS = {
  status: {
    header: 'Status',
    value: (order) => order.status,
    filterable: true,
    filterSelection: 'single',
    filterOptions: STATUSES,
  },
} satisfies TableColumns<Order>;
```

<StoryEmbed id="components-table--single-select-filter" height="420px" />

### Templating an option

`etTableFilterOption` fills one column's option rows with whatever you like — a flag, an avatar,
a subtitle. `let-option` is the option (`label`, `value`, and anything else you put on it) and
`let-selected` whether it is currently picked; the menu keeps the row, its checkbox/radio mark
and its keyboard behaviour.

```html
<et-table [data]="rows()" [columns]="COLUMNS" etTableFilters>
  <ng-template [etTableFilterOption]="COLUMNS.country" let-option>
    <img [src]="option.flag" alt="" width="16" /> {{ option.label }}
  </ng-template>
</et-table>
```

<StoryEmbed id="components-table--templated-filter-options" height="420px" />

## Column menu

Opt in with `TABLE_COLUMN_MENU_IMPORTS` and `etTableColumnMenu` to give every header
a `⋮` holding that column's actions. It carries the [menu](/components/menu) system,
which it shares with [filtering](#filtering) when both are used.

```html
<et-table [data]="rows()" [columns]="COLUMNS" etTableColumnMenu />
```

<StoryEmbed id="components-table--column-menu" height="420px" />

The entries adapt to the column, so the menu never offers a no-op:

| Entry                                               | Shown when                                                 |
| --------------------------------------------------- | ---------------------------------------------------------- |
| **Sort ascending** / **descending**                 | the column is `sortable`                                   |
| **Clear sort**                                      | the column is currently sorted                             |
| **Autosize this column** / **Autosize all columns** | always                                                     |
| **Reset width**                                     | the column carries a [resize](#resizable-columns) override |
| **Hide column**                                     | it isn't the last visible column                           |

Turn any of the last three off per table with
`[etTableColumnMenu]="{ autosize: false }"`, `{ resetWidth: false }` or
`{ hideColumn: false }`. Bringing a hidden column _back_ is the
[column chooser](#column-chooser)'s job, not this menu's.

**Autosize** fits a column to its widest _rendered_ content and keeps that as a width
override, so it round-trips through [`state()`](#table-state) like a manual resize.
It's also callable directly — `autosizeColumn(key)`, `autosizeColumns(keys)`,
`autosizeAllColumns()` — with no need for the menu feature. The measurement lets the
tracks out to `max-content` for one frame and reads back what the browser gave them,
rather than adding up text metrics, so arbitrary cell content (a badge, an avatar, a
nested component) is measured as it actually lays out. On a
[virtualized](#virtualization) table that means the current window: rows outside it
aren't in the DOM to measure. Results are still clamped to the column's
[`minWidth`](#columns) and the table's own width. Hidden columns are ordinary
[column-visibility state](#column-visibility--reordering), so `state()` round-trips
them and your own "columns" chooser can bring one back.

The menu's controls — it and the filter trigger — are **permanently visible** rather
than revealed on hover: a control you have to discover by hovering isn't
discoverable, and one that appears under the pointer makes the header twitch. They
sit in the header's muted ink, with the accent reserved for state that is actually
active (a sorted arrow, a filtered column).

## Column chooser

`<et-table-column-chooser [table]="…" />` (from `TABLE_COLUMN_CHOOSER_IMPORTS`) is a
"Columns" button and menu for toggling column visibility. Bind a template ref to the
table and place it wherever you like:

```html
<et-table #table [data]="rows()" [columns]="COLUMNS" etTableColumnMenu>
  <!-- … -->
</et-table>
```

```html
<div class="toolbar">
  <et-table-column-chooser [table]="table" />
</div>
```

<StoryEmbed id="components-table--column-menu" height="460px" />

It lists **every declared column, hidden ones included** — it is the way back from the
column menu's "Hide column" — and stays open as you toggle, so several columns can go in
one visit. "Show all columns" resets; it's always present, disabled when nothing is
hidden, so the menu never resizes mid-use. The last visible column's checkbox is
disabled: a table with no columns has nothing to show.

::: warning Don't put a visibility list inside the header
This is a separate component, not an entry in the per-column `⋮`, on purpose. A list
that hides columns cannot hang off a control inside the header it edits: hiding a
column relays that header out and drags the menu with it, and hiding the column the
menu was opened from destroys its own anchor, leaving it stranded. Anchor it to a
control the table can't move — a toolbar above the table is the most stable spot, since
even the `[etTableFooter]` bar shifts when the table's own height changes.
:::

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
  [columns]="COLUMNS"
  [sort]="users.sort()"
  (sortChange)="users.setSort($event)"
  sortMode="server"
/>
```

`hasMore` comes from your `toHasMore`, with one backstop: a page that comes back with no
rows reports `hasMore: false` regardless, so a load-more control can't survive one page
past the end when the end can only be inferred. Prefer an exact derivation anyway
(`res.nextPage !== null`, `res.currentPage < res.totalPageCount`).

It returns `rows`, `loading`, `error`, `total`, `hasMore`, `sort`, `filters` and
`page` signals plus `setSort`/`setFilters`/`setPage` — the `args` builder reads
`sort`/`filters`/`page` to build the request. `rows` keeps the previous page visible
while the next one loads (no empty flash); `setSort`/`setFilters` reset to
`initialPage`. Pair with `sortMode="server"` and `filterMode="server"`. Call it from
a field initializer / constructor, like a query or query stack.

For the legacy `V2QueryClient`, use **`tableRowsFromV2Query`** — the same config
and return shape, backed by the legacy `queryComputed` container. Both adapters
share one client-agnostic core (`createTableRowsSource`), so they stay in lockstep.

### One binding instead of six

Bind the source itself and the table wires the rest — rows, `loading`, `error`, and its own
sort/filter changes routed back through the source's setters:

```html
<et-table [rowsSource]="src" [columns]="COLUMNS" />
```

`rowsSource` takes anything of the `TableRowsSource` shape, so both query adapters satisfy it
as they are and a hand-rolled object works too — the table never imports `@ethlete/query`.
Because such a source has already sorted and filtered on the server, `sortMode` and
`filterMode` default to `'server'` while one is bound; set either explicitly to override, and
read `resolvedSortMode()` / `resolvedFilterMode()` for what is actually in effect. The
source's `sort`/`filters` are mirrored into the table's own `sort()` / `filters()`, so
features, `state()` and the header keep a single read path.

## Row expansion

Provide an `expandedRowTemplate` and the table prepends an expander column; each
row toggles a **lazily-instantiated** full-width detail row. Nest another
`<et-table>` in the detail template for **sub-tables**. Set `rowKey` so expansion
state survives data changes; gate rows with `expandableRow`.

The detail row **grows open** — its grid track animates from `0fr` to `1fr` while the
content fades in, so the rows below glide down with it — and it does so only for the
row the user just toggled: a detail row that re-mounts because the rows changed
(paging, sorting, a refetch) appears instantly rather than replaying the reveal. The
animation is reduced-motion-aware. Note that an `fr` track re-resolves the table's
layout every frame, so a very long table on a slow device pays for the effect.

```html
<et-table [data]="orders()" [columns]="COLUMNS" [rowKey]="orderId" [expandedRowTemplate]="detail" />

<ng-template #detail let-order>
  <!-- nest another table for a sub-table -->
  <et-table [data]="order.lines" [columns]="LINE_COLUMNS" />
</ng-template>
```

A nested table needs no dedicated API — it is an ordinary `<et-table>` with its own
columns, `rowKey`, sorting and empty state. Put `etAutoSurface` on it so it paints one
elevation above the table it sits in; keep the `data` array's identity stable (look it
up, don't rebuild it per read) so the sub-table's derived state doesn't churn.

<StoryEmbed id="components-table--expandable-sub-table" height="460px" />

`expandedKeys` is a two-way `Set` of row keys, so you can drive or persist which
rows are open. `isExpanded(row)` / `toggleExpanded(row)` are available on the
table instance.

## Selection

Selection is **opt-in**: import `TABLE_SELECTION_IMPORTS` and put `etTableSelection` on
the table to prepend a checkbox column. Its header checkbox selects or clears every
selectable row (indeterminate when only some are). Pass your own signal as `selection`
and the feature writes the selected row keys into it — set the table's `rowKey` so a
selection survives sorting, filtering and data changes.

```ts
protected selected = signal<Set<unknown>>(new Set());
```

```html
<et-table [data]="users()" [columns]="COLUMNS" [rowKey]="userId" [etTableSelection]="{ selection: selected }" />
```

| `etTableSelection` option | Default  | Description                                                       |
| ------------------------- | -------- | ----------------------------------------------------------------- |
| `selection`               | internal | The `WritableSignal<Set<unknown>>` the selected row keys live in. |
| `selectableRow`           | all rows | `(row: T) => boolean` gating which rows can be selected.          |

Its two accessible labels (`selectAllRows`, `selectRow`) come from the table's
[label set](#localization).

On the feature instance (reachable with `#sel="etTableSelection"`): `isSelected(row)`,
`setSelected(row, checked)`, `toggleAll()`,
and the `selectedRows()` / `isAllSelected()` / `isPartiallySelected()` signals.
Select-all and the "all/some" state consider only the rows currently in view (after
filtering), while `selection` keeps keys for filtered-out rows.

## Row navigation

Set `rowInteractive` to make whole rows respond to clicks: rows get a pointer
affordance and emit `(rowClick)` with the row. The table performs **no** navigation
itself — you wire it, keeping the SDK action-agnostic:

```html
<et-table [data]="orders()" [columns]="COLUMNS" [rowInteractive]="true" (rowClick)="open($event)" />
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
<et-table [data]="rows()" [columns]="COLUMNS" style="block-size: 320px" />
```

## Sticky columns & footer

Pin columns to an edge with `sticky: 'start' | 'end'` — they stay put while the
table scrolls horizontally. Pin from the edges (leading columns to `'start'`,
trailing to `'end'`); give pinned columns explicit widths so the table has
something to scroll.

On a viewport too narrow for the pinned columns to leave room — where they would
otherwise cover the whole width and horizontal scrolling would reveal nothing —
pinning is **automatically suspended** and every column scrolls normally. It
resumes once there's room again, so the same table works on desktop and mobile
without a breakpoint of your own.

Whenever a table scrolls horizontally, a **soft gradient marks each edge that has
content behind it**. With pinned columns the gradient is inset to sit at the pinned
column's _inner_ edge — the boundary rows actually disappear under — rather than at
the viewport's edge on top of the pin. Size it with `--et-table-scroll-fade-size`
(`28px`).

```ts
protected readonly COLUMNS = {
  name: { header: 'Name', value: (user) => user.name, width: '220px', sticky: 'start' },
  email: { header: 'Email', value: (user) => user.email, width: '280px' },
  actions: { header: '', value: (user) => user, width: '96px', sticky: 'end' },
} satisfies TableColumns<User>;
```

An `etTableFooterCell` template adds a **summary row pinned to the bottom** of the
scroll viewport. Its context is the rendered rows, so it can aggregate:

```ts
@Component({
  imports: [TABLE_IMPORTS],
  template: `
    <et-table [data]="orders()" [columns]="COLUMNS" style="block-size: 24rem">
      <ng-template [etTableFooterCell]="COLUMNS.id" let-rows>{{ rows.length }} orders</ng-template>
      <ng-template [etTableFooterCell]="COLUMNS.total" let-rows>{{ sum(rows) | currency }}</ng-template>
    </et-table>
  `,
})
export class OrdersComponent {
  protected readonly COLUMNS = {
    id: { header: 'Order', value: (order) => order.id },
    total: { header: 'Total', value: (order) => order.total, align: 'end' },
  } satisfies TableColumns<Order>;
}
```

Any column with a footer template shows the footer row; columns without one render an
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
    <et-table [data]="rows.rows()" [columns]="COLUMNS" sortMode="server" style="block-size: 32rem">
      <!-- Material-style controls row: label + page-size select + range + prev/next, right-aligned. -->
      <div class="flex flex-wrap items-center justify-end gap-3" etTableFooter>
        <span class="et-table-footer-label">Items per page:</span>
        <!-- `sm` keeps the field compact; pull its 12px control text back to the 14px of the label and
             readout either side of it, so the row reads as one size -->
        <et-form-field appearance="underline" size="sm" style="--et-form-field-control-font-size: 14px">
          <!-- a page-size trigger is narrower than its option rows, so let the panel size itself -->
          <et-select [formField]="pageSizeForm.pageSize" [clearable]="false" [mirrorPanelWidth]="false" />
        </et-form-field>
        <et-pagination
          [page]="rows.page()"
          [totalPages]="totalPages()"
          [totalItems]="rows.total()"
          [pageSize]="pageSizeForm.pageSize().value()"
          [compact]="true"
          (pageChange)="rows.setPage($event)"
        />
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

The slot is layout-only, so its arrangement is yours: the example above is a
right-aligned Material-style row with an external, translatable "Items per page:"
label — given `.et-table-footer-label` so it matches the paginator's own readout
instead of being a near-miss — and an `underline` select (`[mirrorPanelWidth]="false"` keeps its option rows
readable — a page-size trigger is narrower than "20 ✓"). In a table with a bounded
`block-size`, the bar sits at the bottom of the box even when the rows don't fill it. With `[compact]="true"` the paginator renders as a
range readout plus previous/next chevrons that sit inline and hold their position
across page changes. For its other options (links mode, paged SEO, jump-to-page,
the width-driven auto-collapse), see the [pagination guide](/components/pagination).

## Empty state

When `data` is empty the table renders a single full-width row carrying the `empty`
label. Replace it with structure — either a template (which gets the row list) or
projected content:

```html
<et-table [data]="rows()" [columns]="COLUMNS" [emptyTemplate]="nothing">
  <ng-template #nothing>
    No results — <button (click)="clearFilters()" et-button variant="transparent">clear the filters</button>
  </ng-template>
</et-table>

<!-- or, without a template ref -->
<et-table [data]="rows()" [columns]="COLUMNS">
  <div etTableEmpty>No results — try adjusting your filters.</div>
</et-table>
```

Just changing the wording? That is the `empty` [label](#localization), not a template.

## Loading & error states

`loading` and `error` take a query's own signals as they are, so a fetched table needs
two bindings and no wrapper:

```html
<et-table [data]="src.rows()" [columns]="COLUMNS" [loading]="src.loading()" [error]="src.error()" />
```

**`loading` renders differently depending on whether there is anything to show.** With no
rows yet it fills the body with **placeholder rows** — one bar per column, so the layout
doesn't jump when the data lands; `loadingRows` (default `5`) sets how many. Over rows
that are already on screen it leaves them alone and runs an **indeterminate bar under the
header** instead: that is the state a paged or refetching table is in most of the time,
and blanking the body there costs the user their place for nothing. Either way the host
carries `aria-busy`, and the placeholder rows are `aria-hidden`.

<StoryEmbed id="components-table--loading" height="360px" />

**Matching a row's real height.** Placeholder rows exist to keep the layout still, so they have
to be as tall as the rows they stand in for. Two things get that right:

- The table **remembers the height of a real row** and hands it to later placeholder rows, so a
  refetch or a page change keeps the table exactly as tall as the data the user was just looking at.
- For the **first** load there is nothing to measure, so a column whose cells are taller than a line
  of text — a chip, an avatar, a button — says what its placeholder looks like with
  `etTableCellSkeleton`:

```html
<et-table [data]="rows()" [columns]="COLUMNS" [loading]="loading()">
  <ng-template [etTableCell]="COLUMNS.role" let-value>
    <et-chip>{{ value }}</et-chip>
  </ng-template>

  <!-- the same cell while loading: the chip's own height and pill radius -->
  <ng-template [etTableCellSkeleton]="COLUMNS.role">
    <et-skeleton-item shape="rect" style="inline-size: 64px; block-size: 24px; --et-skeleton-radius: 999px" />
  </ng-template>
</et-table>
```

`let-index` is the placeholder row's index and `let-width` the width the default bone would have
used, so a custom shape can stay in the same rhythm. Columns without one keep the default
line-of-text bone (`<et-skeleton-item shape="text">` from the
[Skeleton](/components/skeleton) component), whose widths cycle so a block of them reads as text.

**`error` replaces the body.** Anything non-nullish counts (an `HttpErrorResponse`, a
message, `false`), and it outranks `loading` — stale rows sitting under an unreported
failure are worse than an honest empty table. The `error` [label](#localization) is the
default text; for anything more use `errorTemplate` (it gets the error value) or project
`[etTableError]`:

```html
<et-table [data]="src.rows()" [columns]="COLUMNS" [error]="src.error()" [errorTemplate]="failure">
  <ng-template #failure let-error>
    {{ error.message }}
    <button (click)="src.refetch()" et-button size="sm" type="button">Retry</button>
  </ng-template>
</et-table>
```

<StoryEmbed id="components-table--errored" height="300px" />

The error mark takes the app's **error color theme** (the one registered with
`type: 'error'`). A table in an app that registers none still renders — the mark just
stays on the surface's own color rather than throwing.

### Per-cell states

A cell can be busy or failed on its own — an inline edit saving, one field rejected by the
server. `cellState` is called per rendered cell and returns `'loading'`, `'error'`, or
nothing: `'loading'` swaps that cell's value for a placeholder bar, `'error'` keeps the
value and marks it. The rest of the row stays live.

```ts
protected cellState = (row: User, key: string) =>
  this.saving().get(row.id) === key ? 'loading' : this.failed().get(row.id) === key ? 'error' : null;
```

```html
<et-table [data]="users()" [columns]="COLUMNS" [cellState]="cellState" />
```

Return `{ state: 'error', message }` and the message rides along on the mark — as its `title`
and accessible name in the base table, and as a real tooltip once
`TABLE_CELL_ERROR_TOOLTIP_IMPORTS` / `etTableCellErrorTooltip` is on the table. That is a
separate feature because a tooltip means the overlay runtime, which no table should pay for to
render a list; its mark is stamped only into cells that are actually failing.

`cellState` is resolved once per rendered cell (with the rest of the render model), not per
binding — but keep it a lookup rather than a search. An errored cell also carries
`data-state="error"`, which an app can style further.

<StoryEmbed id="components-table--cell-states" height="360px" />

## Column visibility & reordering

Drag-to-reorder is **opt-in**: import `TABLE_REORDER_IMPORTS` and put
`etTableReorder` on the table to let users **drag column headers** sideways.
A floating ghost of the header follows the pointer, and the columns **slide into the
order they would take on release** — the table itself is the preview, so nothing is
drawn over (or past) its panel. Dropping commits that order with no visual jump,
because the columns are already sitting where it puts them. Reduced-motion drops the
sliding, not the preview. It's pure column-order state — no DOM surgery, since the
grid re-lays-out from the order.

```html
<et-table [data]="rows()" [columns]="COLUMNS" etTableReorder />
```

[Pinned columns](#sticky-columns-footer) are excluded from dragging — they anchor
to an edge, so moving one into the scrolling middle would strand the layout —
though `moveColumn` can still reposition anything programmatically.

Column **order and visibility** are also fully programmatic, so you can build a
"columns" chooser with the [menu](/components/menu):

| Method / signal                  | Description                                               |
| -------------------------------- | --------------------------------------------------------- |
| `moveColumn(key, toIndex)`       | Move a column within the order.                           |
| `allColumns()`                   | Every declared column in order, **hidden ones included**. |
| `visibleColumns()`               | Only the shown ones, in order.                            |
| `hiddenColumnKeys()`             | The keys of the hidden columns, in declared order.        |
| `isColumnVisible(key)`           | Whether a column is shown.                                |
| `setColumnVisible(key, visible)` | Show/hide a column.                                       |
| `toggleColumnVisibility(key)`    | Flip a column's visibility.                               |
| `showAllColumns()`               | Show every hidden column again.                           |

::: tip Bringing a hidden column back
The [column menu](#column-menu)'s **Choose columns** panel already does this. Without
that feature, nothing in the table's own chrome lists a column that isn't rendered, so
expose `allColumns()` + `toggleColumnVisibility()` yourself (or a "Show all columns"
action calling `showAllColumns()`) — otherwise a user can strand a hidden column until
the page reloads.
:::

```html
<!-- a columns chooser: every column, checked when visible -->
<et-menu>
  <et-menu-checkbox-group>
    @for (column of table.allColumns(); track column.key) {
    <et-menu-checkbox-item
      [value]="column.key"
      [checked]="table.isColumnVisible(column.key)"
      (activate)="table.toggleColumnVisibility(column.key)"
    >
      {{ column.header }}
    </et-menu-checkbox-item>
    }
  </et-menu-checkbox-group>
  <et-menu-separator />
  <button (activate)="table.showAllColumns()" et-menu-item type="button">Show all columns</button>
</et-menu>
```

Both order and visibility are captured by [`state()`](#table-state) and restored
by `restoreState()`.

## Resizable columns

Resizing is **opt-in**: import `TABLE_RESIZE_IMPORTS` and put `etTableResize` on the
table, and each header grows a grip on its trailing edge. Drag it to resize
the column; **double-click** it to reset that column to its default width. The grip is
hidden while only one column is visible — a lone column already spans the table, so
there is nothing for it to trade width with.

```html
<et-table [data]="rows()" [columns]="COLUMNS" etTableResize />
```

Resized widths are pixel overrides on top of each column's declared `width` (or the
default `minmax(96px, 1fr)` track), clamped between the column's `minWidth` and the table's
own width (a column can't be dragged wider than the viewport). They're captured by
[`state()`](#table-state) as `TableColumnState.width` and restored by
`restoreState()`, so a user's column widths persist alongside order, visibility,
sort and filters. Resizing **composes with reordering** — the grip is its own drag
handle that swallows its pointer gesture, so grabbing it resizes instead of starting
a header reorder, and because widths are keyed by column they travel with a column
when it's moved. On touch pointers the grip's hit area widens so it's grabbable with
a finger.

## Virtualization

For long lists, import `TABLE_VIRTUAL_SCROLL_IMPORTS` and drop
`etTableVirtualScroll` on the table: only the rows near the viewport render —
a few dozen `<div role="row">`s stay in the DOM no matter how many rows `data` holds,
with block-padding spacers standing in for the rest so the scrollbar still reflects the
full count.

As always, the table is its own scroll container — give it a bounded height so the
window has a viewport to track:

```html
<et-table [data]="rows()" [columns]="COLUMNS" style="block-size: 24rem" etTableVirtualScroll />
```

<StoryEmbed id="components-table--virtualized" height="440px" />

The sticky header pins to the table's own scroll container, so it keeps working.
Row heights are measured from a rendered row and assumed uniform; set the feature's
`estimateRowHeight` (default `48`) close to your real row height for the steadiest first
paint, and raise `overscan` (default `6`) if fast scrolling reveals blank rows before they
render — both options on the directive:

```html
<et-table [etTableVirtualScroll]="{ estimateRowHeight: 52, overscan: 10 }" … />
```

Virtualization composes with [row expansion](#row-expansion) — expanded rows
render within the window as you scroll to them. Because the window assumes a
uniform row height, lists where many rows are expanded at once scroll most
smoothly when expanded content is modest.

## CSV export

Import `TABLE_CSV_EXPORT_IMPORTS`, put `etTableCsvExport` on the table and call `export()`
from a button of your own — the feature renders no UI, so the button is yours to place,
label and translate:

```ts
@Component({
  imports: [TABLE_IMPORTS, TABLE_CSV_EXPORT_IMPORTS, BUTTON_IMPORTS],
  template: `
    <et-table [data]="people()" [columns]="COLUMNS" [etTableCsvExport]="{ filename: 'people.csv' }" #csv="etTableCsvExport" />

    <button et-button (click)="csv.export()">Export CSV</button>
  `,
})
```

By default it writes the **visible columns in their displayed order** — so hiding a column
in the [chooser](#column-chooser) or [dragging one](#column-visibility-reordering) changes
the file — and the table's **own rows**, client-filtered and sorted. What is off screen
because of [virtualization](#virtualization) is still written; virtualization only decides
what renders.

<StoryEmbed id="components-table--csv-export" height="520px" />

### What each cell says

A cell's text comes from the column's `value` accessor. A column whose cell is an
[`etTableCell` template](#custom-cells) needs an **`exportValue`** — a template renders DOM,
which has no text form to serialize — as does a column whose `value` isn't a primitive:

```ts
protected readonly COLUMNS = {
  name: { header: 'Name', value: (person) => person.name },
  // rendered as a chip; the file gets the plain label
  role: { header: 'Role', value: (person) => person.role, exportValue: (person) => person.role },
  // several fields joined into one column
  tags: { header: 'Tags', value: (person) => person.tags, exportValue: (person) => person.tags.join(' | ') },
} satisfies TableColumns<Person>;
```

`exportValue` returns a `string | number | boolean | Date | null | undefined`. Dates are
written as ISO 8601 (the only form that survives a spreadsheet's locale) and nullish
becomes an empty field rather than the text `null`.

### Options

Pass them on the directive, or per call — `export(overrides)` wins over the bound config,
so one directive can serve both an "export everything" and an "export the selection"
button:

```html
<button (click)="csv.export({ rows: selection.selectedRows(), filename: 'selection.csv' })" et-button>
  Export selection
</button>
```

| Option         | Type                             | Default       | What it does                                                                     |
| -------------- | -------------------------------- | ------------- | -------------------------------------------------------------------------------- |
| `columns`      | `'visible' \| 'all' \| string[]` | `'visible'`   | `'all'` adds hidden columns; a key list writes exactly those, in the order given |
| `rows`         | `readonly T[]`                   | table's rows  | Any list — a [selection](#selection), or your untouched data to ignore filters   |
| `header`       | `boolean`                        | `true`        | Write the header row of column labels                                            |
| `delimiter`    | `string`                         | `','`         | Use `';'` for locales where Excel expects it                                     |
| `bom`          | `boolean \| 'auto'`              | `'auto'`      | UTF-8 BOM — see below                                                            |
| `formulaGuard` | `boolean`                        | `true`        | See below                                                                        |
| `filename`     | `string`                         | `'table.csv'` | `.csv` is appended when missing                                                  |

### The BOM

A UTF-8 BOM is what tells **Excel** the file is UTF-8. Without one Excel reads a CSV in the
system's legacy code page, and `Jürgen` arrives as `JÃ¼rgen`. The catch is that not every
reader strips the marker: a text editor on the wrong encoding, most hand-rolled CSV parsers —
and Google Sheets — surface it as a literal `ï»¿` glued to the first header cell.

So the default is `'auto'`: the BOM is written **only when the file actually contains a
non-ASCII character**, which is the only case where it changes anything. A pure-ASCII CSV
reads identically with or without one, so it simply doesn't get it — no stray `ï»¿`, in any
reader. Pass `bom: true` or `bom: false` to force it.

One residue worth knowing: a file that _does_ carry non-ASCII text still gets the BOM, so
opening that one in Google Sheets shows `ï»¿` on the first header. Sheets assumes UTF-8
anyway and never needed the marker — if your exports are headed there rather than to Excel,
set `bom: false` on the directive and be done with it.

`tableToCsv()` never adds a BOM: it hands back a string, and how that gets encoded is the
caller's business.

`formulaGuard` prefixes a **text** field that starts with `=`, `+`, `-`, `@`, a tab or a
carriage return with a `'`, so the spreadsheet shows it instead of running it. This is CSV
injection: without it, a row someone else authored can execute when a colleague opens the
file. Numbers, booleans and dates are never touched, and neither is a string that is simply
a number (`-5`), so ordinary exports are unaffected.

### Without the directive

`injectTableCsvExport()` is the same thing from TypeScript — call it once in a field
initializer, then from anywhere:

```ts
private exportCsv = injectTableCsvExport();
protected table = viewChild.required(TableComponent);

protected download() {
  this.exportCsv(this.table(), { columns: 'all', delimiter: ';' });
}
```

`tableToCsv(table, options)` builds the same file as a string without downloading it — for
uploading it, putting it on the clipboard, or asserting on it in a test. Both are pure of
any table dependency: they read the table through its columns and rows, so a test can pass
a plain object.

Two boundaries worth stating outright. **Excel's own `.xlsx` is not supported** — this
writes CSV, and nothing else. And for a **server-paginated table** the table only ever holds
the current page, so that is what gets written; fetching the rest is your job, since only
you have the query. Pass the result as `rows`:

```ts
const all = await firstValueFrom(this.everyPage$);
this.exportCsv(this.table(), { rows: all });
```

## Keyboard navigation

`role="grid"` promises that the arrows move between cells. Import
`TABLE_KEYBOARD_NAV_IMPORTS`, add `etTableKeyboardNav`, and the table keeps that promise:

```html
<et-table [data]="rows()" [columns]="COLUMNS" etTableKeyboardNav />
```

The body becomes a **single tab stop** — Tab moves onto the last-focused cell and Tab
again leaves the table entirely, rather than walking every cell — and inside it:

| Key                      | Moves to                                     |
| ------------------------ | -------------------------------------------- |
| `←` `→` `↑` `↓`          | the neighbouring cell (clamped at the edges) |
| `Home` / `End`           | first / last cell of the row                 |
| `Ctrl+Home` / `Ctrl+End` | first / last cell of the grid                |
| `PageUp` / `PageDown`    | one viewport of rows up / down               |
| `Enter`                  | into the cell's own control, if it has one   |
| `Escape`                 | back out of that control, onto the cell      |

<StoryEmbed id="components-table--keyboard-navigation" height="520px" />

Clicking a cell moves the tab stop there too, so the arrows always carry on from where the
user actually is.

### Cells that hold controls

`Enter` hands the keyboard to the first focusable thing in the cell — a link, a button, an
[action cell](#action-cells) — and while focus is in there the arrows belong to that
control, not to the grid. `Escape` gives the cell its focus back. This is what keeps a
cell's own content operable without the grid stealing its keys.

### With virtualization

It composes with [virtual scrolling](#virtualization). A row the arrows ask for that isn't
rendered is scrolled into the window first and focused once it exists — so `Ctrl+End` on a
100 000-row table lands on the real last cell. The tab stop is re-anchored after any render
that replaces the cell it was on, which is every scroll of a windowed table and every sort,
filter or page change of any table.

### What it changes

Two things, both deliberate:

- **`rowInteractive` rows stop being tab stops.** The grid body is one tab stop; a row that
  was also one would make it two. The rows stay clickable, and their `rowClick` still fires.
- **Leading utility cells are not in the arrow order.** The [selection](#selection) checkbox
  and the [expander](#row-expansion) are their own tab stops, reachable with Tab as before —
  the arrows walk the data columns.

## Inline cell editing

Import `TABLE_INLINE_EDIT_IMPORTS`, mark a column `editable`, and give it an
`etTableCellEdit` template. That template **is** the editor — while the cell is being
edited the table renders it in place of the value:

```ts
const COLUMNS = {
  name: { header: 'Name', value: (person: Person) => person.name, editable: true },
  email: { header: 'Email', value: (person: Person) => person.email, editable: true },
  role: { header: 'Role', value: (person: Person) => person.role },
} satisfies TableColumns<Person>;
```

```html
<et-table [data]="people()" [columns]="COLUMNS" (cellCommit)="save($event)" etTableInlineEdit etTableKeyboardNav>
  <ng-template [etTableCellEdit]="COLUMNS.name" let-field="field">
    <et-form-field size="sm">
      <et-input [formField]="field" aria-label="Name" />
    </et-form-field>
  </ng-template>
</et-table>
```

`let-field` is the draft, as a **signal-forms field** — bind it with `[formField]` exactly
as you would in a form. There is no cell-editor interface to implement: every control in
this library is already signal-forms native, so any of them can be an editor.

<StoryEmbed id="components-table--inline-editing" height="560px" />

A column marked `editable` with no `etTableCellEdit` template stays read-only, so the flag
is safe to leave on while the template is behind an `@if`.

### The flow

| Key / gesture       | Does                                                            |
| ------------------- | --------------------------------------------------------------- |
| double-click        | starts editing that cell                                        |
| `Enter`             | starts editing the focused cell, and saves the one being edited |
| `Escape`            | cancels, restoring the value                                    |
| `Tab` / `Shift+Tab` | saves and moves to the next cell in the row, editing it too     |

**One cell is in edit mode at a time.** Opening another one saves the first — abandoning
what someone just typed is not what moving on means. Row-edit mode (a whole row of editors
with one Save button) is not part of this feature.

`Enter` needs cell focus, which is [keyboard navigation](#keyboard-navigation) — pair
`etTableKeyboardNav` with it for the full flow. Without it the double-click path still
works. The two features agree on `Enter` through the table: navigation offers the cell to
the editor first and only [drills into the cell's content](#cells-that-hold-controls) when
the column isn't editable.

Committing is explicit. Clicking away from the table does **not** save — a control whose UI
lives in an overlay (a select's panel) moves focus out of the cell legitimately, and
guessing would throw the edit away. Use `Enter`, `Tab`, or open another cell.

### Saving is yours

`cellCommit` **reports** the change; it does not write to your data:

```ts
type TableCellEditCommit<T> = {
  row: T;
  /** the column's key */
  column: string;
  previous: unknown;
  next: unknown;
};
```

Perform the mutation, and report its progress back through the table's
[`cellState`](#per-cell-states) — that is what draws the cell's pending bar and its error
mark, so a failed save is visible on the cell it belongs to instead of in a toast:

```ts
protected save(change: TableCellEditCommit<Person>) {
  const cell = `${change.row.id}:${change.column}`;

  this.saving.update((saving) => new Set(saving).add(cell));

  this.api.patch(change.row.id, { [change.column]: change.next }).subscribe({
    next: () => this.settle(cell),
    error: (error) => this.fail(cell, error.message),
  });
}

// bound as [cellState]
protected cellStateOf = (person: Person, key: string): TableCellStateValue | null => { … };
```

`cellCancel` fires for an abandoned edit — `Escape`, or the edited row leaving the table
(a refetch, a filter, a page change), which closes the editor rather than leaving the draft
floating over whatever row moved into that position.

### Gating individual cells

`editableCell` narrows `editable` per cell — a row the current user may not change, a field
that locks once it has a value:

```html
<et-table [etTableInlineEdit]="{ editableCell: canEdit }" … />
```

```ts
protected canEdit = (person: Person, column: string) => person.id !== LOCKED_ID;
```

## Table state

`state()` is a serializable, versioned snapshot of the table's configurable
state — column **order**, **visibility**, **sort**, **filters** and **width** (per
column), plus **expanded rows**. `restoreState(state)` applies one back. The two
round-trip losslessly, so it's the basis for persisting and sharing a table setup.

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

### Persist it to local or session storage

`etTableStatePersistence` (from `TABLE_STATE_PERSISTENCE_IMPORTS`) restores the stored setup when
the table first renders, then saves on every change:

```html
<et-table [data]="rows()" [columns]="COLUMNS" [etTableStatePersistence]="{ key: 'users-table' }" />
```

| Option    | Default   | Description                                                                   |
| --------- | --------- | ----------------------------------------------------------------------------- |
| `key`     | —         | Storage key. Namespace it per table _and_ per meaning.                        |
| `kind`    | `'local'` | `'local'` survives a browser restart, `'session'` the tab.                    |
| `storage` | the store | Your own `Storage`-like object — an escape hatch for SSR, and what specs use. |
| `enabled` | `true`    | Switch persistence off at runtime.                                            |

A feature rather than an input because storing state is a side effect not every table wants — one
whose columns depend on the route or a permission set should start from its definitions each time.
Use `createTableStateStorage({ key })` (`load` / `save` / `clear`) to drive it yourself; every
operation swallows its own failure, so a blocked or full store never stops a table from rendering.

**Feature state.** `state()` carries a `features` bag alongside the columns — a selection lives in
`features.selection`, contributed by `etTableSelection` through a `TableStateSlice`. That is what
lets feature-owned state round-trip without the base table knowing the feature exists; a slice
whose feature isn't imported on restore is left alone rather than dropped. The bag is why the
schema is `v: 2`; `v: 1` states still restore.

### Restore a table from a link

`serializeTableState()` / `deserializeTableState()` turn a snapshot into a string
you can put in a URL query param (and back), so a filtered, sorted, reordered
table is shareable as a link. Deserialize returns `null` for an absent, malformed
or unknown-version value, so a stale link just falls back to the default view.

```ts
import { deserializeTableState, serializeTableState } from '@ethlete/components';

@Component({
  template: `<et-table #table [data]="rows()" [columns]="COLUMNS" />`,
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

## Localization

Every string the table and its features render or announce lives in one **label set**
(`TableLabels`) — the empty and error text, the expander and selection `aria-label`s, the
sort announcement, the filter menu's search placeholder / "no options" / "Load more", the
column menu's entries, and the column chooser's trigger. No feature carries wording of its
own, so localizing the table localizes all of it.

```ts
import { provideTableLabels } from '@ethlete/components';

// app-wide
provideTableLabels({
  empty: 'Keine Daten',
  filterSearch: 'Suchen…',
  sortAscending: 'Aufsteigend sortieren',
});
```

Anything you leave out keeps its English default (`DEFAULT_TABLE_LABELS`). Strings that
name a column take it as an argument rather than being concatenated, so the translation
decides the word order:

```ts
provideTableLabels({
  sortAction: (header, next) =>
    next === null
      ? `Sortierung nach ${header} aufheben`
      : `${header} ${next === 'asc' ? 'aufsteigend' : 'absteigend'} sortieren`,
  filterColumn: (header) => `${header} filtern`,
});
```

**Driven by an i18n library.** Pass a function instead of an object and it is called with
the active locale — the one `injectLocale()` exposes and `provideLocale()` updates — and
re-called whenever that locale changes, so a language switch re-renders the wording in
place:

```ts
provideTableLabels((locale) => ({
  empty: translate('table.empty', locale),
  filterSearch: translate('table.filter.search', locale),
  sortAction: (header, next) => translate(`table.sort.${next ?? 'clear'}`, locale, { header }),
}));
```

For a one-off wording on a single table, bind `labels` — partial, layered over whatever is
provided:

```html
<et-table [data]="rows()" [columns]="COLUMNS" [labels]="{ empty: 'No people found' }" />
```

The resolved set is readable as `resolvedLabels()` on the table instance, which is also how
features and the column chooser get their strings.

## Accessibility

The table uses the ARIA grid pattern: `role="grid"` on the container, `role="row"`
on each row, `role="columnheader"` on header cells and `role="gridcell"` on body
cells. Sortable headers are real `<button>`s (keyboard-operable) and set
`aria-sort` on their column header.

Cell-by-cell keyboard navigation is [opt-in](#keyboard-navigation): without it Tab
skips past the body, which is what a read-only display table usually wants.

## Theming

Colors come from the [surface theming](/core/theming) tokens of the nearest
surface scope — header/body text from `--et-surface-color-*-solid`, separators
from `--et-surface-border-solid`, and the row hover tint from
`--et-surface-interaction-solid`. Cell padding is tunable via the
`--et-table-cell-padding-block` / `--et-table-cell-padding-inline` custom
properties, and the leading utility columns via `--et-table-expander-width` /
`--et-table-select-width` (both `32px`, sized to their control — the expander button
and the checkbox keep their own size even if you set these narrower).

All of the table's metrics are px, not `rem`, so they don't shift with the host app's
root font size.

## Error codes

See [`ET35xx`](/components/error-codes#table-et35xx).
