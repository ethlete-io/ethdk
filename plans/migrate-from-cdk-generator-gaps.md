# `migrate-from-cdk` generator: gaps found during a real hub migration

Found 2026-08-05 while migrating `fut-frontend`'s hub app and `libs/domain/hub` off
`@ethlete/cdk` (`nx g @ethlete/cdk:migrate-from-cdk --projects=hub,domain-hub` against
`@ethlete/components@1.0.0-next.36`, `@ethlete/cdk@5.0.0-next.26`). The generator's
`migrate-from-cdk-tasks.md` output correctly flagged `PictureComponent`, `QueryErrorComponent`,
`SelectionListFieldComponent`, `createOverlayHandler` and others as manual-decision items with a
`kind`/`note` explaining the contract change. The three issues below are places the generator
either produced invalid code or silently mechanically-renamed an import whose target has no
equivalent API - neither showed up in the manual-decision report, so they only surfaced at
`nx build` (template type-checking), not at generation time or `nx lint`.

## 1. Duplicate import specifier when the target name is already imported under an alias

`apps/hub/src/app/app.config.ts` had, before migration:

```ts
import { provideComboboxConfig, provideOverlay, provideValidatorErrorsService } from '@ethlete/cdk';
import { provideOverlay as provideComponentsOverlay } from '@ethlete/components';
```

Both overlay runtimes were deliberately in use side by side (cdk's overlay handlers hadn't been
migrated yet). The generator rewrote this to:

```ts
import { provideComboboxConfig, provideValidatorErrorsService } from '@ethlete/cdk';
import { provideOverlay as provideComponentsOverlay, provideOverlay } from '@ethlete/components';
```

Two specifiers for the same export in one import (`provideOverlay as provideComponentsOverlay` and
`provideOverlay`) - a straight `error TS2300: Duplicate identifier`. The generator's per-symbol
rename logic didn't check whether the destination module was already imported under an alias
before appending a second, unaliased specifier for the same name.

**Suggested fix:** when appending a renamed symbol to an already-existing import from the target
module, check for an existing specifier with the same imported name (aliased or not) and reuse it
instead of adding a duplicate.

## 2. `imgLoaded` → `imgLoad` template rewrite is unconditional on the import actually migrating

`club-pack-asset-carousel-overlay.component.ts` used `<et-picture (imgLoaded)="...">` bound to
`PictureComponent` from `@ethlete/cdk` - correctly left there and listed in
`migrate-from-cdk-tasks.md` under "Symbols whose contract changed" (its `naturalAspectRatio()`
migration needed a hand-rewrite, so it stayed manual on purpose). The generator nonetheless rewrote
the template binding to `(imgLoad)="..."` in the same pass, even though the bound class is still
cdk's `PictureComponent`, which only emits `imgLoaded`. Result: a template referencing an event the
actually-bound component doesn't have - `error NG8002` only surfaces at `nx build`, not at
generation time.

**Suggested fix:** the `imgLoaded`→`imgLoad` template rewrite should be gated on the same
per-site "did this et-picture's import actually move to `@ethlete/components`" check that already
decides whether to list the site in the manual-decision report - not applied unconditionally
whenever an `(imgLoaded)` binding is found in a touched project.

## 3. `TableImports` → `TABLE_IMPORTS`: mechanical rename onto a completely different API, not flagged

Unlike Picture/QueryError/Overlay, `TableImports` → `TABLE_IMPORTS` was rewritten as a plain
import swap with no manual-decision entry - but the two are structurally unrelated:

- cdk's table is a low-level composition kit: `TableComponent` + `CellDefDirective` /
  `HeaderCellDirective` / `RowDefDirective` / `HeaderRowDefDirective` + `*Def` structural
  directives (`etColumnDef`, `etCellDef`, `etHeaderCellDef`, `etRowDef`, `etHeaderRowDef`), styled
  entirely by the consumer.
- `@ethlete/components`' `TABLE_IMPORTS` is `TableComponent` + `TableFooterDirective` +
  `TableCellDirective` + `TableHeaderCellDirective` + `TableFooterCellDirective` - a
  `[data]` + `[columns]: TableColumns<T>` config-driven table with no `*Def` structural-directive
  layer at all.

A template still using cdk's `etColumnDef`/`etCellDef`/etc. compiles to nothing after the import
swap - `'et-header-cell' is not a known element`, `Can't bind to 'etColumnDef'`, and so on, all
surfacing only at `nx build`. This is exactly the shape of change `migrate-from-cdk-tasks.md`
exists to catch (a rename whose target has a different contract) but it wasn't listed - the
generator's Picture/QueryError/Overlay detection appears to be a hand-maintained list of known
contract changes rather than a structural check, and `TableImports` (and likely `TabImports`,
see below) weren't on it.

**Suggested fix:** either add `TableImports`/`TabImports` to the manual-decision list with a note
pointing at the `[data]`/`[columns]` guide, or - more robustly - derive the manual-decision list
from an actual API diff (exported member names/selectors) between the cdk and components versions
of a migration-map entry, so a future contract change doesn't need a matching hand-maintained
generator entry to be caught.

### Same shape, lower severity: `TabImports` → `TAB_IMPORTS`

`et-inline-tabs`/`et-inline-tab` (cdk) → `et-tab-group`/`et-tab` (components) is a rename plus a
real API change: `[selectedIndex]`/`(selectedIndexChange)` become the two-way `[(selectedIndex)]`
model, and `renderButtons`/`renderMasks`/`renderScrollbars` (cdk's scrollable-chrome config inputs)
have no equivalent at all - the new tab bar's scrollable behavior isn't configurable the same way.
Also not in the manual-decision list; also only surfaces at `nx build`.

## What this meant in practice

Both `TableImports` and `TabImports` sites had to be handled by hand once discovered:
`hub-list-view-sub-table.component.ts` was reverted back to `@ethlete/cdk`'s `TableImports`
entirely (its parent, `@fut/uikit`'s `FutTableComponent`, is itself still built on cdk's table
primitives, so migrating just the sub-table would have mixed the two systems); the
`partner-bulk-edit-overlay` tab bar was rewritten onto `et-tab-group`/`et-tab` since nothing else
in that file depended on cdk's scrollable-chrome inputs.
