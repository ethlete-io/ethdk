# Table core scan - open findings

Scan of `table/headless/`, `table/testing/`, `table/table.component.{ts,html,css}`, `table/table.types.ts`, `table/table.imports.ts`, `table/table-errors.ts`, `table/index.ts` from 2026-09-28. 0 High, 0 Medium, 5 Low, 3 Spec (after verification: 7 verified, 1 re-rated). Skipped: the `table-*.directive.ts` feature files (another scan), all specs and stories except spot checks, and a line-by-line read of the 911-line `table.component.css` (the scan checked the layer wrap, hardcoded colours and feature CSS only).

## table.component

- Low: a lead or trail header cell without a header component is `aria-hidden` (`table/table.component.html:19,120`) while its body cells are not, so the header row announces fewer columns than the rows. S
- Low: the error cell sets `aria-live="polite"` on an element that is created with its content (`table/table.component.html:155`); most screen readers do not announce a live region inserted already filled. S
- Low: `rows` copies the list up to four times per recompute (`filterRows`, `quickFilterRows`, `sortRows`, then `[...result]`) (`table/table.component.ts:930-945`). Drop the final spread. S
- Low: the `enclosed` appearance shadow uses `rgb(0 0 0 / …)` as its primary value (`table/table.component.css:178-180`), outside any token. S

## headless: state (persistence, URL, storage)

- Low: the headless directive imports and injects `TableComponent` for `state`/`restoreState` (`table/headless/table-state-persistence.directive.ts`). Decision: add both to `TableFeatureHost` and retype the public `table` field, or accept the import. S

## Spec gaps

- Spec: no spec restores a stored state into a table that declares a column the state does not list. S
- Spec: no spec for `TableStatePersistenceDirective` with `enabled` toggled after the first render or with a changed `key`. S
- Spec: no spec renders `errorTemplate` with a `rowsSource` error. S
