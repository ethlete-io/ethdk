# table-grid — DX scan 2026-10-02

Scope: `libs/components/src/lib/table`, `libs/components/src/lib/grid`, `libs/components/src/lib/chart`,
plus `apps/docs/components/{table,grid,chart,line-chart,pie-chart,sankey-chart}.md` and the stories.

Overall: the row type reaches every cell template correctly. `etTableCell` / `etTableCellEdit` infer
`T` and `TValue` from the bound column object (`table-templates.ts:60-77`), `rowKey`, `rowLink`,
`rowClick`, `emptyTemplate` and `expandedRowTemplate` all use the table's `T`, and the table already
throws dev-mode errors for most wiring mistakes (ET3503-3511). Most of the friction is in the
server-side path: the query adapters and the sort/filter state they hand to `args`.

| ID    | Sev    | Kind | Decision | Title                                                                                                                         |
| ----- | ------ | ---- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| TG-01 | High   | dx   | yes      | `tableRowsFromQuery` owns its own state, so it cannot be driven by a query form, the URL or a page size                       |
| TG-02 | Medium | dx   | no       | Column flags fail silently when their feature directive is missing (`filterable`, `sticky`, `group`, `editable`)              |
| TG-03 | Medium | dx   | yes      | Server-side sort/filter state is untyped: `key: string`, `values: unknown[]`, and a sort key cannot differ from the API field |
| TG-04 | Medium | dx   | yes      | Charts have no injectable label set; 15 English defaults must be overridden per instance                                      |
| TG-05 | Medium | dx   | no       | CSV export writes `[object Object]` for a non-primitive column with no `exportValue`, with no warning                         |
| TG-06 | Medium | dx   | no       | Bar/line chart: a `data` shape that does not match `series` draws zeros or nothing, with no warning                           |
| TG-07 | Medium | dx   | yes      | Charts emit nothing: no click/activate output for a bar, slice, point or Sankey link                                          |
| TG-08 | Low    | dx   | no       | Table guide: the Inputs table omits `rowsSource`, and the server-side example still uses six bindings                         |
| TG-09 | Low    | dx   | no       | Grid guide: `<et-grid #grid />` gives a `GridComponent`, which has no `addItem` / `restoreState`                              |
| TG-10 | Low    | dx   | no       | `GridDirective.addItem()` returns `void`, so the caller never learns the new item's id                                        |
| TG-11 | Low    | bug  | no       | `TableRowsFromQuery.hasMore()` is `false` while the next page loads when the query does not keep its previous response        |

## TG-01 `tableRowsFromQuery` owns its own state, so it cannot be driven by a query form, the URL or a page size

- Where: `libs/components/src/lib/table/headless/table-rows-from-query.ts:71-74` (and the twin at
  `table-rows-from-v2-query.ts:71-74`), `libs/components/src/lib/table/headless/table-rows-source.ts:8-17`,
  `apps/docs/components/table.md:1166-1205`.
- Problem: the adapter creates private `signal()`s for `sort`, `filters`, `page` and `quickFilter`.
  The config only takes `initial*` values. So:
  - A list page that keeps its sort, page and search in the URL with `defineQueryForm`
    (`tableSortQueryField()`, `queryField<number>` page, `searchQueryField()`) cannot use the adapter or
    `[rowsSource]`. The two systems the docs point to (`table.md:433` for the URL sort, `table.md:725` for
    the adapter) do not connect, and no guide says so. The consumer has to hand-roll a `TableRowsSource`.
  - Page size is not part of `TableRowsQueryState`. The documented pagination example (`table.md:1198`)
    reads `pageSizeForm` from inside `args`. Changing the page size therefore does not reset `page`, so a
    user on page 9 at 10 rows who switches to 100 rows asks for a page past the end. `setSort`,
    `setFilters` and `setQuickFilter` all reset the page (`table-rows-source.ts:156-168`); a page-size
    change has no equivalent.
- Fix: let the config accept existing writable signals in place of the internal ones
  (`sort?: WritableSignal<TableSort[]>`, `filters?`, `page?`, `quickFilter?`), and add
  `pageSize` / `setPageSize` (with a page reset) to `TableRowsQueryState` and `TableRowsFromQuery`.
  `createTableRowsSource` already takes `WritableSignal`s, so the core needs no change. Then document a
  "URL-backed table" recipe that binds `qf.fields.sort().value` and friends straight into the adapter.
- Breaking: no (additive). Decision: yes (new API shape, and how it interacts with `isResetBy`).

## TG-02 Column flags fail silently when their feature directive is missing

- Status: fixed (ET3512 `MISSING_COLUMN_FEATURE`; the filter adornment claims `filterable` through a new `columnFlag` field on `TableHeaderAdornment`)
- Review: ok

- Where: `libs/components/src/lib/table/table.types.ts:225` (`filterable`), `:257` (`sticky`), `:306`
  (`group`), `:218` (`editable`); `table.component.ts:771-776` (`visibleColumns` ignores `sticky` when no
  pinning feature registered); `table-inline-edit.directive.ts:351-353`.
- Problem: a consumer who writes `{ filterable: true, filterOptions: [...] }`, `{ sticky: 'start' }` or
  `{ group: 'Season' }` and forgets `etTableFilters` / `etTableStickyColumns` / `etTableGroupHeaders`
  sees an ordinary column, with no error. The same holds for `editable: true` with no
  `etTableInlineEdit`. The table already treats this kind of mistake as an error elsewhere:
  `expandedRowTemplate` without `etTableRowExpansion` throws ET3508 (`table.component.ts:1240-1250`),
  router `rowLink` without `etTableRowRouterLink` throws ET3509, and `pinColumn()` without sticky columns
  throws ET3511. These column flags are the gap in that pattern.
- Fix: add one dev-mode `effect` next to the ET3508 check. If any column declares `filterable`,
  `sticky`, `group` or `editable` and the matching feature list is empty (`headerAdornmentList` with the
  filter adornment, `columnPinningList`, `headerRowList`, `cellEditingList`), throw a new ET35xx that
  names the column, the directive and the `TABLE_*_IMPORTS` constant. Like ET3508, ask whether a feature
  registered at all, not whether it is enabled, so `{ enabled: false }` stays legal. Add a row to
  `apps/docs/components/error-codes.md`.
- Breaking: no (dev-mode only). Decision: no.

## TG-03 Server-side sort/filter state is untyped, and a sort key cannot differ from the API field

- Where: `libs/components/src/lib/table/table.types.ts:26-29` (`TableSort.key: string`), `:63-66`
  (`TableFilter.values: unknown[]`), `:46-49` (`TableFilterOption.value: unknown`); `table.component.ts:371`
  (`cellState: (row, key: string)`); `table-inline-edit.directive.ts:46` (`editableCell: (row, column: string)`).
- Problem: the `args` builder of `tableRowsFromQuery` is where a consumer turns table state into a
  request, and every value it reads there is untyped:
  ```ts
  args: ({ sort, filters }) => ({
    queryParams: {
      sortBy: sort()[0]?.key,                                     // string, not 'name' | 'joined'
      status: filters().find((f) => f.key === 'status')?.values as Status[], // cast required
    },
  }),
  ```
  A column renamed in `COLUMNS` still compiles and sends the old key to the backend. A column key also has
  to equal the backend's sort field: there is no `sortKey` / `serverKey` on `TableColumn`, so
  `joinedLabel` vs `joined_at` needs a hand-written map in every `args`. The same `string` keys show up
  in `cellState` and `editableCell`.
- Fix: (a) make `TableSort`, `TableFilter`, `TableRowsQueryState` and the adapters generic in the column
  key (`TableSort<K extends string = string>`), inferred from a `columns` record passed to the adapter or
  from an explicit type argument. (b) Add an optional `sortKey?: string` (and `filterKey?`) to
  `TableColumn`, which a source receives in place of the column key. (c) Add a helper such as
  `filterValues<V>(filters, key)` so the cast disappears.
- Breaking: possibly (generic defaults keep it source-compatible). Decision: yes.

## TG-04 Charts have no injectable label set; 15 English defaults must be overridden per instance

- Status: fixed (2026-10-08, `CHART_LABELS` / `provideChartLabels` / `injectChartLabels` with 16 keys incl. the key-hint formatter; chart inputs stay as overrides)
- Where: `libs/components/src/lib/chart/headless/bar-chart.directive.ts:177,180`,
  `line-chart.directive.ts:225,228,231`, `pie-chart.directive.ts:100,103,106`,
  `pie-chart.component.ts:66`, `sankey-chart.directive.ts:188,191,194,197,200,203`, and
  `defaultSankeyChartLinkKeyHint` at `sankey-chart.directive.ts:52-59` (hardcoded `"of"`, `"next link"`,
  `"Esc back to"`).
- Problem: every other domain localizes through `provideXLabels` (`apps/docs/components/localization.md:105-135`
  lists 30 of them, including `GRID_LABELS` and `TABLE_LABELS`). Charts have none. A German app has to set
  `categoryHeader`, `valueHeader`, `shareHeader`, `totalLabel`, `incomingLabel`, ... on every chart
  instance. Most of these strings feed the visually hidden data table (assistive tech only), so a
  forgotten one never shows up in a visual review.
- Fix: add `CHART_LABELS` / `provideChartLabels` / `injectChartLabels`, following `grid-labels.ts`, with
  keys for each header, the pie total, the Sankey in/out/separator and a key-hint formatter. Keep the
  inputs as per-chart overrides, defaulting to the injected value. Add the row to `localization.md`.
- Breaking: no (if inputs stay as overrides). Decision: yes (label keys and the key-hint signature).

## TG-05 CSV export writes `[object Object]` for a non-primitive column with no `exportValue`

- Status: fixed (ET3513 `UNSERIALIZABLE_EXPORT_VALUE`, a dev-mode throw)
- Review: fixed (dropped needless `exportValue` casts from string-only specs)

- Where: `libs/components/src/lib/table/headless/table-csv-export.ts:156-161` (`serialize` falls back to
  `String(value)`), `:229`; contract stated at `table.types.ts:200-206` and `table-csv-export.ts:210-213`.
- Problem: the JSDoc says `exportValue` is "required" for a column whose `value` is not a primitive (or
  that renders through `etTableCell`). Neither the type nor the code enforces this. A column
  `{ value: (u) => u.address }` with no `exportValue` exports `[object Object]` in every row, and no
  error is raised. The error path for unknown export columns is already a dev-mode throw (ET3505, `:193`).
- Fix: in `tableToCsv`, in dev mode, throw (or `console.warn`) a new ET35xx the first time a column
  without `exportValue` returns a value that is not a `TableCsvValue` (an object, array or function). Name
  the column key and say "add `exportValue`".
- Breaking: no. Decision: no.

## TG-06 Bar/line chart: a `data` shape that does not match `series` draws zeros or nothing, with no warning

- Status: fixed (dev-mode `console.warn` from both directives via `describeSeriesDataMismatch`; no generic typing)
- Review: fixed (removed an internal JSDoc)

- Where: `libs/components/src/lib/chart/headless/bar-chart.directive.ts:142` (input typed as a union),
  `:222-237`; `line-chart.directive.ts:180`, `:299-310`.
- Problem: `data` accepts `BarChartDatum[] | BarChartSeriesDatum[]` whatever `series` holds. Three
  mistakes all render a plausible but wrong chart:
  - Series data (`{ label, values }`) without `[series]`: `datum.value` is `undefined`, so `:228` draws
    every bar at `0`.
  - Single-series data with `[series]` set: every value is `null`, so nothing is drawn.
  - A series `key` with a typo (`boxoffice` vs `boxOffice`): that series is empty.
    The only dev checks are a shared color warning (`:436-446`) and, for line charts, mixed x types.
- Fix: in the dev-mode `effect`, warn when (a) `series` is empty but data items carry `values`,
  (b) `series` is set but data items carry `value`, (c) a series key appears in no datum's `values`.
  Optionally type the inputs with a `K extends string` generic, so `series[].key` and `values` keys must
  match (Decision then becomes yes).
- Breaking: no (warnings only). Decision: no.

## TG-07 Charts emit nothing: no click/activate output for a bar, slice, point or Sankey link

- Status: fixed (2026-10-08, `(markActivate)` on bar, line, pie and Sankey; payload types `BarChartMarkActivateEvent`, `LineChartMarkActivateEvent` (`series` is the list with a value at the x), `PieChartDatum`, `SankeyChartMarkActivateEvent`; Sankey Enter still steps into a node's links)
- Where: `libs/components/src/lib/chart/*.component.ts` and `headless/*.directive.ts`: no `output()`
  anywhere in the chart folder.
- Problem: drill-down ("click a month to open its orders", "click a slice to filter the table") is the
  most common chart interaction in a dashboard. Today it needs the headless directive and a hand-built
  SVG, even though the default components already track the active mark for keyboard focus and tooltips
  (`sankey-chart-mark.directive.ts`, `line-chart-slice.directive.ts`).
- Fix: add `(markActivate)` (pointer click plus Enter/Space on the focused mark) to the four default
  components. The payload is the datum and series key (`{ datum, series }` for bar and line, the
  `PieChartDatum` for pie, the node or link input for Sankey). Document it and add a story per chart.
- Breaking: no. Decision: yes (new API and payload shape).

## TG-08 Table guide: Inputs table omits `rowsSource`; server-side example still uses six bindings

- Status: fixed (Inputs row, both table examples and `pagination.md` use `[rowsSource]`; no new story)
- Review: ok

- Where: `apps/docs/components/table.md:106-129` (Inputs table), `:739-747` (example), `:1173` (pagination
  example with `[data]` + `sortMode`).
- Problem: `rowsSource` (`table.component.ts:313`) is the recommended server-side binding
  ("One binding instead of six", `table.md:769`), but it is missing from the Inputs table. The main
  "Server-side rows" example still writes `[data]`, `[sort]`, `(sortChange)` and `sortMode` by hand,
  which is the boilerplate the next section says to drop. `pagination.md:280-281` repeats the old form.
  No story uses `tableRowsFromQuery` itself (the story's `serverRows` is hand-rolled,
  `stories/table-storybook.component.ts:454`).
- Fix: add `rowsSource` to the Inputs table, and rewrite both examples (and `pagination.md`) to
  `<et-table [rowsSource]="users" [columns]="COLUMNS" />`.
- Breaking: no. Decision: no.

## TG-09 Grid guide: `<et-grid #grid />` gives a `GridComponent`, which has no `addItem` / `restoreState`

- Status: fixed (`#grid="etGrid"` verified to resolve the host directive, spec added; guide updated)
- Review: ok

- Where: `apps/docs/components/grid.md:87`; `libs/components/src/lib/grid/grid.component.ts:93`
  (`public grid = inject(GridDirective)`), `headless/grid.directive.ts:128` (`exportAs: 'etGrid'` on the
  host directive).
- Problem: the guide says to get a handle with `<et-grid #grid />` and call `addItem()` /
  `restoreState()`. A plain `#grid` on `et-grid` resolves to `GridComponent`, which exposes the API only
  through `.grid`, so `grid.addItem(...)` does not compile. The stories use `gridRef()?.grid.…`
  (`stories/components/grid-partner-storybook.component.ts:276,284`).
- Fix: document `#grid="etGrid"` (after checking that the host directive's `exportAs` resolves), or
  `viewChild(GridComponent)` followed by `.grid`. Or forward the imperative methods on `GridComponent`.
- Breaking: no. Decision: no.

## TG-10 `GridDirective.addItem()` returns `void`, so the caller never learns the new item's id

- Status: fixed (`addItem` returns the id; no `id` option)
- Review: ok

- Where: `libs/components/src/lib/grid/headless/grid.directive.ts:696-707`.
- Problem: `addItem(type, data)` makes a `randomId()` and discards it. A caller who wants to focus the new
  widget, scroll to it, save it, or remove it again on undo has to diff `currentItems()` before and
  after the call.
- Fix: return the new id (or the `GridItemConfig`) from `addItem`, and optionally accept an `id` option.
- Breaking: no. Decision: no.

## TG-11 `TableRowsFromQuery.hasMore()` is `false` while the next page loads when the query does not keep its previous response

- Status: fixed (`hasMore` is a `linkedSignal` folding the previous value on `null`; spec fails before the fix)
- Review: ok

- Where: `libs/components/src/lib/table/headless/table-rows-source.ts:133-150`; `table-rows-from-query.ts:85`.
- Problem: `rows` and `total` use `linkedSignal` to keep the previous value while `driver.response()` is
  `null`. `hasMore` returns `false` on `null`. A GET query keeps its previous response by default
  (`libs/query/src/lib/http/base-query-factory.ts:250`), so it is not affected. A list query with
  `keepPreviousResponse: false` (for example a POST search) loses its "load more" button for the whole
  time the next page loads, and gets it back afterwards. The V2 adapter caches the response
  (`table-rows-from-v2-query.ts:86`), so it is not affected either.
- Fix: derive `hasMore` with the same `linkedSignal` "previous on null" fold as `total`. Add a spec with
  `keepPreviousResponse: false` that checks `hasMore()` stays `true` while page 2 is in flight.
- Breaking: no. Decision: no.
