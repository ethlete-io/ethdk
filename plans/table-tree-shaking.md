# Table — make the features tree-shakeable

**Status: complete — all five phases shipped 2026-07-25.** Size: L — split into
shippable phases, each one green (tests + stories) on its own.

> **Superseded in part by [`table-api-rfc.md`](./table-api-rfc.md) (2026-07-27).** The
> three seams and the tree-shaking model below still hold, but features are no longer
> child components of `<et-table>` — they are directives on it, and the seams take
> component types instead of `TemplateRef`s. The "Feature API shape" section and the
> `<ng-content />` note in phase 2 describe the old shape; read the RFC for the current
> one. The size table's per-feature deltas were re-measured there.

## Why

`plans/cdk-port/01-table.md` requirement #2 was "**light by default, tree-shakable
features** — the base table renders typed rows/cells and nothing else. Sort, filter
menus, sticky, reordering, nesting, virtualization, state persistence are each separate
opt-in directives / secondary imports so unused features drop out of the bundle." The
shipped table missed that: every feature lives in one 1083-line component whose
`imports` array statically references everything, so a read-only table pays for all of
it.

What a plain `<et-table [data] [columns] />` drags in today:

| Static import                       | Only used by                      | Approx. source |
| ----------------------------------- | --------------------------------- | -------------- |
| `menu` family (7 symbols)           | `filterable` columns              | ~2,700 LOC     |
| `CheckboxComponent`                 | `selectable`                      | ~450 LOC       |
| `DragHandleDirective` (+ core drag) | `reorderable`, `resizableColumns` | core drag      |
| `createVirtualWindow`               | `virtualScroll`                   | ~200 LOC       |
| `sortRows` / `filterRows`           | client sort/filter modes          | ~95 LOC        |

Plus one 372-line template function and one 653-line global stylesheet, shipped whole.

The table is **not released yet** (its changeset is still pending), so the API can be
reshaped now without a deprecation cycle.

## Extension seams

Three seams on the base table, each fed by DI self-registration (the parent never
`viewChild`s for features — see `docs/COMPONENT-ARCHITECTURE.md`):

- **A — lead columns.** A registered contributor supplies a track width plus header /
  body / footer / group cell templates for a leading utility column. Feeds _selection_
  and _row expansion_ (today hardcoded in six places across four row types).
- **B — header adornments.** A registered contributor supplies a template rendered
  inside every header cell, with the column as context. Feeds the _filter menu_ and the
  _resize grip_.
- **C — rows pipeline.** Ordered `readonly T[] → readonly T[]` transforms, plus an
  optional windowing contributor (slice + spacer templates + row-index offset). Feeds
  _client filter_, _client sort_ and _virtual scroll_.

Reorder needs no template seam: the feature directive owns delegated pointer handling
on the host and renders its ghost/indicator from its own view.

## Feature API shape

Uniform: every feature is a child component of `et-table` that registers itself and
renders nothing itself — its `<ng-template>`s are pulled into the base's seams. This
keeps the heavy symbols referenced only by the feature the consumer imported, needs no
dynamic component creation, and resolves in a single CD pass (content children are
created before the parent's view executes).

```html
<et-table [data]="rows()" [columns]="columns">
  <et-table-filters />
  <et-table-selection [(selection)]="selected" />
</et-table>
```

`TABLE_IMPORTS` stays lean (base + footer + empty slot). Each feature ships its own
aggregation array — `TABLE_FILTER_IMPORTS`, `TABLE_SELECTION_IMPORTS`, … — so a
consumer's `imports` is what decides the bundle.

## Phases

Ordered by bundle win per unit of churn.

1. ~~**Filters**~~ **done.** Seam B (`registerHeaderAdornment` + `TABLE_FEATURE_HOST`)
   and `<et-table-filters>` (`TABLE_FILTER_IMPORTS`) own the menu markup, the
   search/provider plumbing and the filter CSS. The base table's `imports` is down to
   `[NgTemplateOutlet, DragHandleDirective, CheckboxComponent]`. `filters` / `filterMode`
   stayed on the table so `state()` / `restoreState()` still round-trip.
   Also fixed here: `nx build components` was failing before this work (Angular types
   `$event` for the `keydown.enter` / `keydown.space` pseudo-events as `Event`, not
   `KeyboardEvent`) — `activateRow` now takes `Event` and narrows.
2. ~~**Resize + reorder**~~ **done.** `<et-table-resize>` (`TABLE_RESIZE_IMPORTS`) puts its grip in
   via Seam B and can use `etDragHandle` normally, since the grip is in its own template.
   `<et-table-reorder>` (`TABLE_REORDER_IMPORTS`) can't — the drag lives on header cells the table
   renders — so it delegates `pointerdown` from the table host and drives the new
   `dragGestureFrom()` primitive (extracted from `etDragHandle` in `@ethlete/core`), rendering the
   ghost/indicator from its own view and marking the dragged cell imperatively. Width/order state
   stayed on the table.
   Two things this phase taught, both worth remembering:
   - A feature component is content of `<et-table>` but was **not projected**, so its host element
     never entered the DOM and anything it rendered itself was invisible. The base now ends with a
     catch-all `<ng-content />`, and each feature's CSS keeps its own host at zero size.
   - `animate.enter` / `animate.leave` look for a running animation **on the element they put the
     class on**. An animation on a child is never awaited: Angular strips the class immediately and
     nothing animates. Keep detail/enter animations on the class-carrying element.
3. ~~**Selection + expansion**~~ **done.** Seam A (`registerLeadColumn`) turns leading utility
   columns into a registry: one generic loop per row kind (group / header / body / footer) replaces
   six hardcoded blocks. `<et-table-selection>` (`TABLE_SELECTION_IMPORTS`) registers one and owns the
   checkbox, the selection state (two-way `selection`, `selectableRow`, labels) and the selected-row
   styling. Row expansion stayed in the base — it has no heavy dependency — but now registers itself
   through the same seam, so the base template has no special-casing left.
4. ~~**Virtual scroll**~~ **done.** Seam C (`registerRowWindow`) takes a slice function plus
   padding/offset signals; `<et-table-virtual-scroll>` (`TABLE_VIRTUAL_SCROLL_IMPORTS`) owns
   `createVirtualWindow`, `estimateRowHeight` / `overscan` and the row measurement. Registering two
   windows throws `ET3502` in dev.
   **Deliberately not moved:** the client `sortRows` / `filterRows` algorithms (~95 LOC of exported
   pure functions). Making them opt-in would mean a table with `sortMode="client"` and no extra import
   silently stops sorting — a footgun worth far more than 95 lines. `sortMode` / `filterMode` stay on
   the base.
5. ~~**CSS split + docs**~~ **done.** Each feature's rules live in its own component's styles (filter
   menu, resize grip, drag ghost/indicator, select cell + selected-row tints, virtual spacer);
   `apps/docs/components/table.md` opens with an "Opt-in features" table; the pending table changeset
   describes the model.
   **Measurement: blocked by a library-wide problem, not by the table.** See below.

### Measurement — results

Measured per feature set with the real pipeline (see below). Gzipped, minimal consumer:

| entry                                  | gz      | vs base  |
| -------------------------------------- | ------- | -------- |
| `paginate` only (floor for any import) | 50.1 kB | —        |
| `TABLE_IMPORTS` (base table)           | 57.3 kB | baseline |
| `+ TABLE_RESIZE_IMPORTS`               | 57.8 kB | +0.5 kB  |
| `+ TABLE_VIRTUAL_SCROLL_IMPORTS`       | 58.0 kB | +0.7 kB  |
| `+ TABLE_REORDER_IMPORTS`              | 58.5 kB | +1.2 kB  |
| `+ TABLE_SELECTION_IMPORTS`            | 60.1 kB | +2.8 kB  |
| `+ TABLE_FILTER_IMPORTS`               | 66.1 kB | +8.8 kB  |
| every feature                          | 71.3 kB | +14.0 kB |

**Before this work** the table had a single entry point that carried all of it: **69.3 kB gz**. So a
read-only table went 69.3 → 57.3 kB gz (−12 kB, ~17%), and each feature is now billed to whoever asks
for it — filters being by far the most expensive, as expected from the menu system. A table that uses
_everything_ costs ~2 kB more than before, which is the price of five component wrappers plus their
registration; that trade is the point.

### How to measure (the pipeline that matters)

Two passes are required, and leaving either out makes the whole library look non-tree-shakable:

1. **The Angular linker** (`@angular/compiler-cli/linker/babel`). ng-packagr publishes _partial_
   declarations; without linking, ~300 bare `ɵɵngDeclareClassMetadata(…)` calls pin every class.
2. **Angular's optimizer babel passes**, which an application build runs and which exist precisely to
   make the compiled output droppable:
   `@angular/build/src/tools/babel/plugins/{adjust-static-class-members,elide-angular-metadata,pure-toplevel-functions}`.
   At `target: es2022` ngtsc emits `ɵcmp`/`ɵfac` inside class `static {}` blocks, which no bundler will
   drop, and the nested `ɵɵHostDirectivesFeature(…)` / `ɵɵProvidersFeature(…)` calls inside a
   PURE-annotated `ɵɵdefineComponent({…})` are not themselves annotated. `adjust-static-class-members`
   rewrites both into forms a bundler can prune.

Then bundle with `--define:ngDevMode=false` and gzip. With only step 1, every entry point measures the
same 255 kB gz — which is what led me to wrongly conclude the package was not tree-shakable at all.

The harness lives in the session scratchpad as `measure-appbuild.mjs` (linker → optimizer passes →
esbuild → gzip, one entry per feature set) and `measure-before.mjs` (same, against a pre-refactor FESM).

**Consumer caveat worth knowing:** an app bundled _without_ Angular's builder (plain Vite/esbuild/Rollup
over the published FESM) does not get those passes and therefore gets no tree-shaking from this package.
If that ever needs supporting, the fix is to run the same two passes as part of this repo's own publish
pipeline rather than leaving them to the consumer.

## Rules for every phase

- The base table must end the phase with **no** static reference to the feature's
  dependencies (grep its `imports` array).
- Feature state that `state()` / `restoreState()` serialize stays owned by the base;
  features read and write it through the base's public API, so a table can restore a
  filter/width/selection state even before the feature is imported.
- Sort _headers_ stay in the base (a button + inline SVG, no dependency); only the
  client `sortRows`/`filterRows` algorithms move behind Seam C.
- Update the story, the docs page and the tests in the same phase — and re-run
  `npx nx test components` plus a Storybook drive of the affected stories.
