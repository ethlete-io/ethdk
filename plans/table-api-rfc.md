# Table API - RFC: cell rendering and feature attachment

**Status: implemented 2026-07-27 - all five phases shipped.** Written 2026-07-27 against the shipped
table (`libs/components/src/lib/table`), the CDK-era table it replaced
(`libs/cdk/src/lib/components/table`), `node_modules/@angular/cdk@…/types/table.d.ts`,
and the plans that produced the current design
(the completed `cdk-port/01-table` plan and [`table-tree-shaking.md`](./table-tree-shaking.md)).

The table is **not released** - `.changeset/table.md` is still pending, so breaking
changes cost nothing and no deprecation cycle is needed. Any change from this RFC
**edits `.changeset/table.md`** rather than adding a new changeset.

Two things feel wrong about the current API:

1. the opt-in features are **elements** (`<et-table-reorder />`) that render nothing;
2. the way cells and headers are **rendered** - templates handed in through the column
   objects.

Both are gaps against the table's own original requirements, not new ideas.
`cdk-port/01-table.md` asked for:

> 1. **Type-safe end to end** - the row type `T` flows from data source through column
>    defs into cell template contexts (via `ngTemplateContextGuard`). No string-matching
>    column names against templates without compiler checks.
> 2. **Light by default, tree-shakable features** - … each **separate opt-in directives**
>    / secondary imports …

Requirement 1 is unmet (contexts are hand-written at the `viewChild` site and never
checked against the column's `value`), and requirement 2 shipped as child components
instead of directives. This RFC closes both.

---

## 1. Findings

### 1.1 The features are elements because the seam is template-shaped

Four of the five features hand the table a `TemplateRef`:

| Feature        | What it registers                          | Where                                  |
| -------------- | ------------------------------------------ | -------------------------------------- |
| selection      | header + body cell templates               | `table-selection.component.ts:43-44`   |
| filters        | header adornment template (the whole menu) | `table-filters.component.ts:51`        |
| resize         | header adornment template (the grip)       | `table-resize.component.ts:29`         |
| reorder        | _nothing_ - delegates pointer events       | `table-reorder.component.ts:55`        |
| virtual scroll | _nothing_ - a row window (pure data)       | `table-virtual-scroll.component.ts:41` |

A `@Directive` has no view, so it cannot declare `<ng-template>`. A `@Component` with
an attribute selector cannot help either: Angular allows one component per element, so
it can never sit on `<et-table>`. Hence: a feature that supplies markup must be its own
element. That is the entire causal chain - and `table-tree-shaking.md:49-55` records it
as a deliberate choice, for reasons that were correct at the time (no dynamic component
creation, one CD pass).

The costs are visible in the source:

- `table.component.html:263` - a bare catch-all `<ng-content />` at the end of the
  table's own template whose only job is to give unprojected feature hosts a home, with
  each feature's CSS forcing its host to zero size (`table-tree-shaking.md:88-91`).
- `table-virtual-scroll.component.ts:20` - `template: ''`. A component that exists only
  because everything else is one.
- All five features' doc comments have to say "it renders nothing itself".

**Two of them need no view at all today**, and reorder proves the alternative works:
it attaches to header cells _the table renders_ by delegating `pointerdown` from
`table.element` and hit-testing `headerCellElements()`. So "features must be elements"
is a property of the adornment seam, not of Angular.

### 1.2 Feature inputs already collide on the table's namespace

`TableFiltersComponent.emptyLabel` (`table-filters.component.ts:48`, "No options") and
`TableComponent.emptyLabel` (`table.component.ts:109`, "No data") are different things
with the same name. Any move to host directives must not put both on `<et-table>`
unprefixed - see §3.3.

### 1.3 Templates in the column objects reset the user's column state

`columnOrder`, `hiddenColumns` and `columnWidths` are `linkedSignal`s derived from the
`columns` input (`table.component.ts:245-259`), so a **new array reference resets them**

- that is `linkedSignal`'s contract. And because a `cell` / `headerCell` / `footerCell`
  is a `TemplateRef` obtained from `viewChild()`, the column array _must_ be built in a
  `computed()`, which recomputes for reasons that have nothing to do with the columns.

Verified with a throwaway spec - identical column content, new array reference:

```
after user actions       [{ key: 'role', hidden: true }, { key: 'name', hidden: false, width: 321 }]
after columns recompute  [{ key: 'name', hidden: false }, { key: 'role', hidden: false }]
```

A reorder, a resize and a hidden column, all silently discarded. In
`stories/table-storybook.component.ts:239` that fires when the `grouped` toggle flips;
in a real app, whenever anything the column `computed()` reads changes. No test covers
it.

### 1.4 The current cell seam is type-poor - but so is the CDK's

Today the consumer restates the context by hand and nothing checks it against the
column's `value` accessor:

```ts
public roleCell = viewChild<TemplateRef<TableCellContext<Person, Person['role']>>>('roleCell');
```

The CDK is no better, contrary to what its ergonomics suggest: `CdkCellDef` is
`template: TemplateRef<any>` with **no** `ngTemplateContextGuard`
(`node_modules/@angular/cdk/types/table.d.ts:33-38`), so `*cdkCellDef="let row"` is
`any`. That is exactly why the repo's own CDK-era story opens with
`/* eslint-disable @typescript-eslint/no-explicit-any */`
(`libs/cdk/.../stories/components/table-storybook.component.ts:1`).

So neither prior art solves requirement 1. What CDK _does_ get right is **placement**:
the template sits lexically inside the column it belongs to, instead of 100 lines away
and `undefined` on the first render pass.

### 1.5 The repo already has the pattern that fixes it

- `libs/components/.../select/headless/select-option-template.directive.ts` - an
  `ng-template[etSelectOptionTemplate]` directive that self-registers with its parent
  through DI and carries a `static ngTemplateContextGuard`.
- `libs/query/.../legacy/directives/query.directive.ts:76-101` - a **generic** directive
  whose static context guard infers `Q` from an `input.required<Q>({ alias })`. This is
  the load-bearing mechanism for §3.2, and it is already in production here.
- `.changeset/allow-static-template-context-guard.md` - the styleguide's static-member
  ban already excepts `ngTemplateContextGuard`.

### 1.6 Columns-as-data is a hard requirement - going back to CDK's shape is out

`cdk-port/01-table.md` makes the data-driven column path first-class, because the
backends drive tables from a server-side "list view" system: per-column `slug` /
`hidden` / `valueSortOrder` / `hasFilter` / `filterValues`, server-defined column types,
async paginated filter options, and named saved views. `TableState` is shaped to map 1:1
onto that. CDK-style column defs have no equivalent, and Material ships neither resize,
reorder, filter menus nor a table-integrated virtual window.

So the answer is not "be more like the CDK table". It is: keep the data model, adopt the
CDK's _seam_.

---

## 2. Design space

| Approach                                               | Who renders cells        | How features attach                                           | Real examples                                                                                                                                                                                                             | Pays with                                                                                                             |
| ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Consumer-owned markup                                  | consumer (`*cdkCellDef`) | directives on the host **and on the consumer's own cells**    | Angular CDK/Material, `libs/cdk`, `@angular/aria` primitives                                                                                                                                                              | ~6–8 lines of markup per column; row type is `any`; no column config as data; no resize/reorder/filter/virtual at all |
| Column defs as data, cell renderers as component types | table                    | features are **values** - a config array or a module registry | AG Grid (`columnDefs` + `cellRenderer` + `ModuleRegistry.registerModules([…])`), TanStack Table (`getSortedRowModel()`, `_features`; the Angular adapter's `FlexRender` stamps a `TemplateRef` _or_ a component per cell) | a renderer indirection; a component instance per cell                                                                 |
| Table-owned markup, features as flags                  | table                    | boolean/enum inputs                                           | PrimeNG (`[resizableColumns]`, `[selectionMode]`), Kendo, Syncfusion                                                                                                                                                      | no tree-shaking granularity - one mega component                                                                      |
| Fully headless                                         | consumer, all of it      | features are functions over state                             | TanStack core, `@angular/aria`                                                                                                                                                                                            | no chrome at all                                                                                                      |

Where the current design sits: row 2's data model with row 1's _hope_ of directives, and
neither's rendering seam - templates pushed **into** the config object, which is the one
combination nobody else ships.

Note that the "features as values" shape is not exotic: it is what the two most-used
data grids converged on, for the same reason this table wants it (the table owns the
render loop, and unused features must drop out of the bundle).

---

## 3. Decision

Three changes, independently shippable, in this order.

### 3.1 Columns become a keyed record

```ts
const COLUMNS = tableColumns<Person>({
  name: { header: 'Name', value: (p) => p.name, sortable: true },
  role: { header: 'Role', value: (p) => p.role, filterable: true },
});
```

- `key` is the record key - one less thing to keep in sync, and duplicate keys become
  impossible by construction (the `ET35xx` `DUPLICATE_COLUMN_KEY` throw in
  `table.component.ts:266` and its `columnsByKey` guard disappear).
- Order is key insertion order - well defined for string keys, and the runtime order is
  `columnOrder` anyway.
- `COLUMNS.role` is addressable from the template, which is what makes §3.2's inference
  possible.
- The dynamic path is unaffected: build the record at runtime from a list-view DTO.

### 3.2 Cell templates become content-child directives with an inferred context

```html
<et-table [data]="people()" [columns]="COLUMNS">
  <ng-template [etTableCell]="COLUMNS.role" let-row let-value="value">
    <et-chip>{{ value }}</et-chip>
  </ng-template>

  <ng-template [etTableFooterCell]="COLUMNS.name" let-rows>{{ rows.length }} people</ng-template>
  <ng-template etTableDetail let-row>…</ng-template>
</et-table>
```

```ts
@Directive({ selector: 'ng-template[etTableCell]' })
export class TableCellDirective<T, V> {
  public column = input.required<TableColumn<T, V>>({ alias: 'etTableCell' });

  // same shape as QueryDirective's guard - infers T and V from the bound column
  public static ngTemplateContextGuard<T, V>(
    _dir: TableCellDirective<T, V>,
    _ctx: unknown,
  ): _ctx is TableCellContext<T, V> {
    return true;
  }
}
```

What this buys:

- `let-row` is `Person` and `let-value` is `'Admin' | 'Editor' | 'Viewer'`, **inferred**
  from the column, not restated. Requirement 1, met - and better than either CDK or the
  current design.
- The template sits next to the table, and is never `undefined` on a first pass.
- `columns` can be a module-level `const`, so §1.3's state reset becomes structurally
  impossible rather than merely fixed.
- The directive self-registers with the table through DI (`select-option-template`'s
  pattern), so the table keeps its "never `viewChild` for contributors" rule.

A string fallback (`etTableCell="role"`) stays available for runtime-built column
records, where nothing could be inferred anyway.

**Independently of this**, `columnOrder` / `hiddenColumns` / `columnWidths` should
reconcile against the column keys (keep overrides for keys that still exist, append new
ones) instead of resetting wholesale - a plain-const `columns` makes the reset rare, not
impossible, and a table driven by a server list view will still swap column sets.

### 3.3 Features become directives on `<et-table>`; the seams take component types

```html
<et-table
  [data]="people()"
  [columns]="COLUMNS"
  [etTableVirtualScroll]="{ estimateRowHeight: 52 }"
  [etTableSelection]="{ selection: selected }"
  etTableFilters
  etTableResize
  etTableReorder
/>
```

The blocker was that seams A (lead columns) and B (header adornments) take
`TemplateRef`s. Change them to take a **component type**, stamped with
`NgComponentOutlet` (already in `@angular/common`, next to the `NgTemplateOutlet` the
base table imports):

```ts
// seam B, in the base table's header cell
@for (chrome of headerChrome(); track chrome.key) {
  <ng-container *ngComponentOutlet="chrome.component; inputs: { column }" />
}
```

Then a feature needs no view of its own, so every one of them can be a `@Directive`:

| Feature        | Today                                | After                                                                                                                                                                     |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| reorder        | element + own view (ghost/indicator) | directive; ghost/indicator rendered by a component the base stamps into an overlay slot, behavior unchanged (delegation already)                                          |
| resize         | element + grip template              | directive; registers a grip component for seam B                                                                                                                          |
| filters        | element + menu template              | directive; registers a filter-trigger component for seam B (that component owns the menu markup, so the menu system is still referenced only from the feature's own file) |
| selection      | element + 2 cell templates           | directive; registers a lead column whose header/body cells are components                                                                                                 |
| virtual scroll | element, `template: ''`              | directive; seam C is pure data and needs no change                                                                                                                        |

Consequences:

- `table.component.html:263`'s catch-all `<ng-content />` is deleted, and with it the
  per-feature "keep my host at zero size" CSS.
- Registration moves from a content child's constructor to a **host directive's**
  constructor, which runs _earlier_ in the same creation pass - so the single-CD-pass
  property `table-tree-shaking.md:54` relied on is preserved, not weakened.
- Tree-shaking is unchanged: the heavy symbols (menu, checkbox, drag) are referenced
  only from the feature's own files, and `TABLE_*_IMPORTS` still decide the bundle. The
  measured per-feature costs in `table-tree-shaking.md:116-127` should be re-measured
  with the same harness, and are expected to shift by well under 1 kB per feature (a
  directive instead of a component, plus `NgComponentOutlet` once in the base).

**Feature options go in a config object per directive**, not as loose inputs on
`<et-table>` - `[etTableSelection]="{ selection: selected, selectableRow: … }"`. This
avoids §1.2's `emptyLabel` collision by construction, keeps each feature's options
namespaced and typed, and matches how the rest of the SDK prefers explicit per-call-site
config. Two-way state is "pass the `WritableSignal` in" rather than `[(selection)]`,
which is also how `tableRowsFromQuery` and the query/form factories already read.

### 3.4 Considered and rejected

- **Features as a `[features]="[tableResize(), …]"` array** (AG Grid / TanStack shape).
  Equivalent on tree-shaking and namespacing, and it composes in TS (`const ADMIN_TABLE
= […]`). Rejected because once §3.3 removes the need for a view, a directive gets the
  same result with template-checked inputs, no `runInInjectionContext` plumbing, and
  Angular-idiomatic DI - and `@if`-style conditional enabling survives as
  `[etTableResize]="enabled()"`. Worth revisiting only if feature _presets_ become a
  real need.
- **Going CDK-shaped (`etColumnDef` + `*etCellDef` + `*etRowDef`)** - §1.6: it cannot
  express server-driven column config, costs ~6–8 lines of markup per column, and
  wouldn't even fix the typing (§1.4).
- **Base table renders the filter menu / checkbox chrome itself**, features supply only
  behavior. Cheapest possible seam, but it puts the menu system (+8.8 kB gz) and the
  checkbox (+2.8 kB) back into every table. Non-starter.
- **Feature directive creates a hidden template-carrier component** to keep the current
  per-cell `ngTemplateOutlet` path. Keeps rendering identical and avoids per-cell
  component instances, but a `ViewContainerRef` on the host inserts that carrier as a
  DOM sibling _outside_ the table - the same parking-lot problem, moved. Keep as the
  escape hatch if per-cell component overhead ever measures badly on wide tables.

---

## 4. Consumer API, before and after

```html
<!-- before -->
<et-table [data]="people()" [columns]="columns()" [expandedRowTemplate]="detail">
  <et-table-filters />
  <et-table-resize />
  <et-table-reorder />
  <et-table-selection [(selection)]="selected" />
  <et-table-virtual-scroll [estimateRowHeight]="52" />
</et-table>
<ng-template #detail let-person>…</ng-template>
<ng-template #roleCell let-value="value">…</ng-template>
```

```ts
public roleCell = viewChild<TemplateRef<TableCellContext<Person, Person['role']>>>('roleCell');
protected columns = computed(() => tableColumns<Person>([
  { key: 'name', header: 'Name', value: (p) => p.name, sortable: true },
  { key: 'role', header: 'Role', value: (p) => p.role, cell: this.roleCell(), filterable: true },
]));
```

```html
<!-- after -->
<et-table
  [data]="people()"
  [columns]="COLUMNS"
  [etTableSelection]="{ selection: selected }"
  [etTableVirtualScroll]="{ estimateRowHeight: 52 }"
  etTableFilters
  etTableResize
  etTableReorder
>
  <ng-template [etTableCell]="COLUMNS.role" let-value="value">…</ng-template>
  <ng-template etTableDetail let-person>…</ng-template>
</et-table>
```

```ts
protected readonly COLUMNS = tableColumns<Person>({
  name: { header: 'Name', value: (p) => p.name, sortable: true },
  role: { header: 'Role', value: (p) => p.role, filterable: true },
});
```

No `viewChild`, no `computed()`, no restated context types, no elements that render
nothing - and `let-value` is `Person['role']` rather than whatever was typed by hand.

---

## 5. Phases

Each phase ends green: `npx nx test components`, `npx nx lint components --fix`, the
stories driven in Storybook (`verify-in-storybook`), `apps/docs/components/table.md`
updated, and `.changeset/table.md` **edited** - never a new changeset file.

1. **Column-state reconciliation** (§3.2 tail). API-neutral, fixes §1.3 on its own, and
   lands the regression test that is missing today. Ship first, independent of
   everything else.
2. **Keyed column record** (§3.1). Touches `tableColumns`, `table.types.ts`,
   `columnsByKey`/`orderedColumns`, the error codes, every spec, the story and the docs
   page. No behavior change.
3. **Cell/header/footer/detail template directives** (§3.2). Adds
   `etTableCell` / `etTableHeaderCell` / `etTableFooterCell` / `etTableDetail`, removes
   `cell` / `headerCell` / `footerCell` / `expandedRowTemplate` from the column objects
   and the table's inputs. Biggest docs delta - `apps/docs/components/table.md:145-236`
   (custom cells + cookbook) is written entirely around the old seam.
4. **Seams A/B take component types** (§3.3, mechanical half). Base table swaps
   `ngTemplateOutlet` for `ngComponentOutlet` in header cells and lead cells; the five
   features keep their element selectors for this phase so it stays behavior-only and
   individually verifiable.
5. **Features become directives** (§3.3, the API half). Selector change per feature,
   config objects, delete the catch-all `<ng-content />` and the zero-size host CSS.
   Re-measure with `table-tree-shaking.md`'s harness and update the size table there and
   in the changeset.

Phases 1–2 are safe on their own. 3 is the one worth spiking first: build
`etTableCell` against a two-column story and confirm the inference before converting
anything (`QueryDirective` says it will work, but it is load-bearing enough to prove).

## 6. Outcome - what shipped, and where it deviates from this plan

All five phases landed in order. `npx nx test components` (76 table tests), `nx lint
components`, `nx build components` and `nx build docs` are green, and every table story was
driven headlessly (render + sort/filter/select/expand/resize/reorder interactions, no
console errors).

Three deliberate deviations:

- **No `tableColumns()` helper at all** (§3.1 assumed one). TypeScript has no partial type
  argument inference, so `tableColumns<Row, C>(…)` can't infer `C` while `Row` is explicit,
  and defaulting `C` throws the per-column value types away. `satisfies TableColumns<Row>`
  gives the same contextual typing of every `value` accessor with no helper and better
  per-property errors, so `table-columns.ts` was deleted rather than curried.
- **`expandedRowTemplate` stayed a table input** - no `etTableDetail` directive. A detail
  template isn't in the column objects, so it never had the problems this RFC fixes, and a
  content-child directive could not infer the row type without a witness input to bind
  (there is no column to bind for a table-wide template). `#detail` + the input is already
  viewChild-free.
- **Two seam additions that weren't in the plan.** Registrations now carry an optional
  `enabled: Signal<boolean>`, because a directive cannot be conditionally applied the way
  `@if (resizable()) { <et-table-resize /> }` could - this is what `{ enabled: … }` drives.
  And a fourth seam, `registerLayer`, hosts a feature's own floating UI (§6's reorder
  question): the reorder ghost/indicator became `TableReorderOverlayComponent`, so reorder
  needs no element and the catch-all `<ng-content />` could go. Every feature is a
  directive; none is an exception.

Feature cells are stamped with `NgComponentOutlet` and resolve from the **feature's own
injector**, which is what lets a stamped cell `inject()` the feature that registered it
(the table's own expander cell needs no injector - it is created in the table's view).

### Re-measured sizes

The harness had to be rebuilt from §5 of `table-tree-shaking.md` (one gotcha: the
`@angular/build` babel plugin paths are no longer in its `exports`, so they must be
required by absolute path). Per-feature deltas are essentially unchanged:

| feature        | before   | after    |
| -------------- | -------- | -------- |
| resize         | +0.5 kB  | +0.5 kB  |
| virtual scroll | +0.7 kB  | +0.7 kB  |
| reorder        | +1.2 kB  | +1.4 kB  |
| selection      | +2.8 kB  | +2.8 kB  |
| filters        | +8.8 kB  | +9.8 kB  |
| all five       | +14.0 kB | +14.9 kB |

The ~1 kB growth on filters and ~0.2 kB on reorder is the cost of the extra component
wrappers that replaced their templates - the price of features having no view of their own.
Absolute figures are **not** comparable to the earlier run (a base table now measures ~83 kB
gz against a ~78 kB floor, where the old harness reported 57.3/50.1): the package has grown
a lot since 2026-07-25 and the two harnesses differ in their externals. Deltas are the
comparable part; re-measure both sides in one run if an absolute number is ever needed.

## 7. Open questions

- **Per-cell component instances.** Seam A stamps one component per lead cell per row -
  and the table's own expander cell is now one too. Bounded by the virtual window when
  it's on, unbounded when it isn't. Not yet measured on a 2,000-row selection table;
  §3.4's carrier fallback exists if it ever regresses.
- ~~**Reorder's ghost.**~~ Resolved: the layer seam (§6). The base renders registered
  layer components after the grid; reorder registers one and stays a directive.
- **Header adornment ordering.** `order` numbers (filters 0, resize 10) survive as-is;
  worth checking whether a named slot (`'trailing'`) reads better once the chrome is
  components rather than templates.
- **Does the `group` header row need the same treatment?** Group labels are plain
  strings today; a `etTableGroupHeader` template directive would round out the seam but
  nothing has asked for it.
