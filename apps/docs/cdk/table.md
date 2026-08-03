# Table & sort

A declarative table built on `@angular/cdk/table` - describe each column once, then declare which rows to render - plus sortable headers that integrate with it but also work standalone.

::: warning Superseded by @ethlete/components
New code should use the [components table](/components/table) (`TABLE_IMPORTS`), which is not built on
`@angular/cdk/table` and is type-safe end to end - the row type flows from your data through the column
definitions into every cell. The shape of the API is different:

| CDK                                                          | components                                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `etColumnDef` + `*etHeaderCellDef` / `*etCellDef` per column | one typed `TableColumns<Row>` object bound to `[columns]`, `[data]` for the rows              |
| `*etHeaderRowDef` / `*etRowDef` listing column names         | column order is the object's key order; no row defs                                           |
| `etSort` + `[et-sort-header]` + `provideSort()`              | `sortable: true` per column, two-way `[(sort)]`, `sortMode="server"` for query-driven sorting |
| `TableDataSource` (client filter/sort/page)                  | the table's own client mode, the exported `sortRows()` helper, and the opt-in filter menus    |
| `busy` + `ng-template[etTableBusy]`                          | `[loading]` / `[error]` taking a query's signals, with placeholder rows and a refetch bar     |
| `ng-template[etNoDataRow]`                                   | the built-in empty state                                                                      |

Everything heavier than typed rows, sort headers, sticky columns and the empty state is an opt-in feature
directive there (filters, selection, resize, reorder, virtual scroll, CSV export, inline editing, state
persistence), so a table only pays for what it imports. This page documents the CDK version, which still
receives bug fixes.
:::

```ts
import { TableImports, SortImports, provideSort, TableDataSource } from '@ethlete/cdk';
```

## Table

Columns are defined with `etColumnDef` containers holding header/cell/footer templates; rows pick which columns they render:

```html
<et-table [dataSource]="(dataSource$ | async)!" (etSortChange)="sortChange($event)" etSort>
  <ng-container etColumnDef="name" sticky>
    <et-header-cell *etHeaderCellDef et-sort-header> Name </et-header-cell>
    <et-cell *etCellDef="let row"> {{ row.name }} </et-cell>
  </ng-container>

  <ng-container etColumnDef="weight">
    <et-header-cell *etHeaderCellDef et-sort-header> Weight </et-header-cell>
    <et-cell *etCellDef="let row"> {{ row.weight }} </et-cell>
  </ng-container>

  <et-header-row *etHeaderRowDef="['name', 'weight']" />
  <et-row *etRowDef="let row; columns: ['name', 'weight']" />
</et-table>
```

```ts
@Component({ imports: [TableImports, SortImports, AsyncPipe] })
export class ElementsTableComponent {
  dataSource$ = new BehaviorSubject([
    { name: 'Hydrogen', weight: 1.0079 },
    { name: 'Helium', weight: 4.0026 },
  ]);

  readonly table = viewChild.required(TableComponent);

  sortChange(sort: Sort) {
    // reorder the data yourself, then:
    this.table().renderRows();
  }
}
```

<StoryEmbed id="cdk-table--default" height="420px" />

### Building blocks

| Piece                                                  | Purpose                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `et-table` / `table[et-table]`                         | The table itself. Use the `table[et-table]` form for native `<table>`/`<thead>`/`<tbody>` semantics.      |
| `etColumnDef="name"`                                   | Declares a column; adds an `et-column-<name>` class to its cells. Supports `sticky` / `stickyEnd`.        |
| `*etHeaderCellDef` / `*etCellDef` / `*etFooterCellDef` | Templates for the column's header, data and footer cells (`et-header-cell`, `et-cell`, `et-footer-cell`). |
| `*etHeaderRowDef` / `*etRowDef` / `*etFooterRowDef`    | Which columns each row type renders, in order. Row defs support `sticky` too.                             |
| `et-text-column`                                       | Shorthand for a plain text column (`name`, `headerText`, `dataAccessor`, `justify`).                      |
| `ng-template[etNoDataRow]`                             | Rendered when the data source is empty.                                                                   |

`dataSource` accepts an array, an observable of arrays, or a CDK `DataSource`. Inherited from the CDK table you also get `trackBy`, `fixedLayout` and `multiTemplateDataRows`.

### Busy overlay

Set `busy` (default `false`) and project an `etTableBusy` template - the table renders it over the body without tearing down rows, and sets `aria-busy` while active:

```html
<et-table [dataSource]="data" [busy]="isLoading">
  <!-- column & row defs -->
  <ng-template etTableBusy>
    <et-progress-spinner />
  </ng-template>
</et-table>
```

The template's root element gets the `et-table-busy` class for positioning.

### TableDataSource

For client-side filtering, sorting and paging there's `TableDataSource<T>` - the equivalent of Material's `MatTableDataSource`. Assign `data`, `filter`, `sort` (a `SortDirective`) and optionally a `paginator`, and it pipes rows through filter → sort → page automatically. Override `sortingDataAccessor`, `sortData` or `filterPredicate` to customize.

## Sort

The `etSort` directive tracks the active sort; `[et-sort-header]` elements register with it and cycle **ascending → descending → cleared** on click (start direction via `etSortStart`, drop the cleared state with `etSortDisableClear`). Inside a table column, a header without an explicit id inherits the column's name.

<StoryEmbed id="cdk-sort--default" height="220px" />

| Input / output (on `etSort`)       | Default | Purpose                                                                                                                                                     |
| ---------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `etSortActive` / `etSortDirection` | `''`    | The currently sorted column id and direction.                                                                                                               |
| `etSortStart`                      | `'asc'` | Direction a column starts with when first clicked.                                                                                                          |
| `etSortDisableClear`               | `false` | Skip the cleared state in the cycle.                                                                                                                        |
| `sortControl`                      | -       | `FormControl<Sort \| null>` two-way bound to the combined `{ active, direction }` state (also available split as `sortByControl` / `sortDirectionControl`). |
| `(etSortChange)`                   | -       | Emits `Sort` on every change - reorder your data (or re-query) here.                                                                                        |

Per header you can set `arrowPosition` (`'after'` by default), `disableClear`, `disabled` and `sortActionDescription` (the screen-reader description of the sort action, default `'Sort'`). App-wide defaults go through the `SORT_DEFAULT_OPTIONS` token; `provideSort()` sets up the `SortHeaderIntl` service whose `changes` subject re-renders all headers (useful for runtime language switches).

Sort headers are fully accessible: `aria-sort` on the header, a `role="button"` sort trigger with keyboard support (Space/Enter) and a direction-arrow hint on keyboard focus.

## Styling

The table ships structural CSS with a few custom properties on `.et-table` - `--et-table-separator-color`, `--et-table-separator-width`, `--et-table-row-min-height`, `--et-table-header-row-min-height`, `--et-table-row-inline-padding` and friends. Cells and rows expose `et-header-row`, `et-row`, `et-cell`, `et-column-<name>` and `et-table-sticky` classes; sort headers expose `et-sort-header`, `et-sort-header-container`, `et-sort-header-arrow` and `et-sort-header-sorted`.
