# Table core scan - open findings

Scan of `table/headless/`, `table/testing/`, `table/table.component.{ts,html,css}`, `table/table.types.ts`, `table/table.imports.ts`, `table/table-errors.ts`, `table/index.ts` from 2026-09-28. 0 High, 2 Medium, 15 Low, 3 Spec (after verification: 7 verified, 1 re-rated). Skipped: the `table-*.directive.ts` feature files (another scan), all specs and stories except spot checks, and a line-by-line read of the 911-line `table.component.css` (the scan checked the layer wrap, hardcoded colours and feature CSS only).

## table.component

- Medium: the grid carries `role="grid"` and every cell `role="gridcell"` without keyboard navigation (`table/table.component.html:400`, `:198,221`). ARIA `grid` promises arrow-key navigation, and without `etTableKeyboardNav` a screen-reader user gets a widget that does not answer. Fix: render `role="table"` / `role="cell"` unless a cell-navigation feature is live. M Verified. The keyboard-nav JSDoc itself calls the bare grid role "a promise it doesn't keep".
- Low: `originatesFromInteractive` misses `<label>`, `[contenteditable]` and `role="checkbox|switch|link|menuitem|tab"`, and `hasAttribute('etMenuTrigger')` never matches a `[etMenuTrigger]="menu"` property binding (`table/table.component.ts:2138-2139`). A click on such content emits `rowClick`. Fix: extend the list and check `aria-haspopup` instead of the selector attribute. S
- Low: a lead or trail header cell without a header component is `aria-hidden` (`table/table.component.html:19,120`) while its body cells are not, so the header row announces fewer columns than the rows. S
- Low: the error cell sets `aria-live="polite"` on an element that is created with its content (`table/table.component.html:155`); most screen readers do not announce a live region inserted already filled. S
- Low: `TableComponent` does not declare `implements TableFeatureHost` (`table/table.component.ts:287`), so `{ provide: TABLE_FEATURE_HOST, useExisting: TableComponent }` is not type-checked and the class can drift from the contract. S
- Low: `pinColumn` uses the `ngDevMode` global (`table/table.component.ts:1899`) and every other dev check uses `isDevMode()`. S
- Low: `rows` copies the list up to four times per recompute (`filterRows`, `quickFilterRows`, `sortRows`, then `[...result]`) (`table/table.component.ts:930-945`). Drop the final spread. S
- Low: comments outside the allowlist - an orphan JSDoc block with no declaration under it (`table/table.component.ts:99-107`), a `{@link DEFAULT_TRACK}` to a const that does not exist (`:203`), a stale "Inline-start offset for the auto-pinned expander column" above `hostDimensions` (`:620`), a "later, row-keyed state" note on `rowKey` (`:312-313`), and a `── Render models ──` section header above an unrelated method (`:2124-2126`). S
- Low: the `enclosed` appearance shadow uses `rgb(0 0 0 / …)` as its primary value (`table/table.component.css:178-180`), outside any token. S

## headless: state (persistence, URL, storage)

- Medium: `TableStatePersistenceDirective` restores only once, at the first render and only if enabled then (`table/headless/table-state-persistence.directive.ts:58-67`), but saves on every later change. `enabled` switched on later (a setting loaded async) or a new `key` never loads the stored setup and overwrites it with the current state. Fix: restore when `enabled` turns true or `storage` changes, and skip the save for that pass. M Verified. The `storage` JSDoc says one table "can move stores", but a moved key never loads.
- Low: the directive injects `TableComponent` in a field initializer (`table/headless/table-state-persistence.directive.ts:34`), which runs before `injectTableFeatureHost` (`:54`); outside a table it throws a `NullInjectorError`, not the labelled `ET3501` the comment promises. It also makes the headless layer import the component. Fix: read `state`/`restoreState` through the feature host. S

## headless: CSV export

- Low: a query `file` that ends in the query client's `cancel` state errors the export with `undefined` (`table/headless/table-csv-export.ts:250`). Fix: map cancel to a named error or to completion. S

## headless: rows sources

- Low: the fallback error text `'Something went wrong'` is hardcoded English (`table/headless/table-rows-from-query.ts:40`, `table-rows-from-v2-query.ts:54`) and bypasses `TableLabels`. S
- Low: `TableRowsFromQuery` JSDoc still says to bind `[data]`, `[sort]` and wire `(sortChange)` / `(filtersChange)` (`table/headless/table-rows-source.ts:55,73,75`), where the current API is `[rowsSource]`. S
- Low: `hasMore` runs `toRows(response)` a second time (`table/headless/table-rows-source.ts:143`); read `rows()` instead. S

## types, barrels

- Low: `TableRowKey` is exported and used nowhere (`table/table.types.ts:381`). S
- Low: narration comments - the architecture essay atop `table/headless/index.ts:1-8` and the "Note: … intentionally depends on" block in `table-rows-from-query.ts`. S

## Spec gaps

- Spec: no spec restores a stored state into a table that declares a column the state does not list. S
- Spec: no spec for `TableStatePersistenceDirective` with `enabled` toggled after the first render or with a changed `key`. S
- Spec: no spec renders `errorTemplate` with a `rowsSource` error. S
