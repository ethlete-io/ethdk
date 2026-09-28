# table features scan - open findings

Scan of `libs/components/src/lib/table/table-*.{ts,html,css}` (top level, specs excluded) from 2026-09-28. 0 High, 8 Medium, 14 Low, 3 Spec (after verification: 8 verified, 1 re-rated). Skipped: `table.component.*`, `headless/` (except the CSV serializer in `headless/table-csv-export.ts`, read for the formula-injection check), `testing/`, `stories/`. Read the CSS files only for layer, colour and interaction-state rules.

## CSV export

- Low: The formula guard applies only when the cell value is a `string` (`table/headless/table-csv-export.ts:174`). An `exportValue` that returns an array or an object whose `toString()` starts with `=`/`+`/`-`/`@` (for example `['=cmd|...']`) goes out without the guard. Run the guard on the serialized text for every non-number, non-Date value. S
- Low: A field with leading whitespace before the trigger character (` =1+1`) does not match `FORMULA_PREFIX` (`table/headless/table-csv-export.ts:142`), and some spreadsheet importers trim leading whitespace before they evaluate the cell. Test the prefix after `trimStart()`. S

## Inline edit

- Medium: The edit session stores an absolute `position` and does not update it when the rows are re-sorted or the columns are reordered while the editor is open (`table-inline-edit.directive.ts:56`, `:361`). The editor still renders on the correct row, because the render uses row identity. But `cellOf()` then returns a different cell, so `handleKeydown` ignores Enter, Tab and Escape (`:247`), and `restoreFocus` moves focus to the wrong cell. Find the position again from `rowIdentity(session.row)` and the column key each time. M Verified. The rows effect cancels only when the row leaves the list, and nothing commits on blur, so a header sort click re-sorts under an open editor.
- Low: `injectHostTable` is copied between `table-inline-edit.directive.ts:391` and `table-csv-export.directive.ts:109`, and `cellFrom` repeats the arithmetic in `table-keyboard-nav.directive.ts:234`. Move both helpers onto the feature host. S
- Low: The file imports from `@ethlete/core` twice (`table-inline-edit.directive.ts:15`, `:19`). S

## Keyboard navigation / a11y

- Medium: The lead and trail cells (the selection checkbox and the expander button) have no `#bodyCell`, so the roving grid does not reach them. Their controls each stay in the Tab order (`table-select-cell.component.ts`, `table-expander-cell.component.ts`). With `etTableKeyboardNav` and `etTableSelection` together, the body is one Tab stop per row plus one, not the single Tab stop that the directive documents. The same applies to the `tabindex="0"` error icon (`table-cell-error-mark.component.ts:27`). M Verified. Lead cells carry no `#bodyCell` and no `tabindex`, and the `et-checkbox` keeps its own stop.
- Medium: The resize grip is `aria-hidden` and responds only to a pointer (`table-resize-grip.component.ts:26`), so a keyboard user cannot resize a column (WCAG 2.1.1). The column menu has "autosize" and "reset", but no resize step. Add a focusable `role="separator"` with arrow-key steps, or add a width step to the column menu. M Verified. The column menu's autosize is the only keyboard path to a width change.
- Low: A group header cell with `role="columnheader"` spans several columns, but it sets no `aria-colspan` (`table-group-header-row.component.ts`). Screen readers then number the columns wrong. S
- Low: The JSDoc says `directionOf` "drives the menu's checked state" (`table-column-menu.directive.ts:61`), but the sort items are plain `et-menu-item`s and do not show which sort is active. Use radio items, or correct the doc. S

## Resize / reorder in RTL

- Medium: The reorder preview and the drop target use physical x. `translateX(delta)` comes from inline-order offsets (`table-reorder.directive.ts:493`), `before` is `clientX < middle` (`:408`), and the auto-scroll zones use `bounds.left + frozen.start` (`:331`). In RTL the columns slide the wrong way, the drop lands on the wrong side, and the auto-scroll zone is at the wrong edge. M Verified.
- Low: The reorder code leaves an inline `transition` (either `none` or `transform 160ms`) on every header and body cell that moved (`table-reorder.directive.ts:505`). That inline value overrides any transition the cell CSS declares. Remove the `transition` style in `clearPreview`. S
- Low: `headerCellAt` accepts a press anywhere in the header cell (`table-reorder.directive.ts:244`), so a drag or a touch long-press on the filter or column-menu button starts a column reorder. Ignore presses that start on an interactive descendant. S

## Drag scroll

- Low: The `scrollable` flag updates only when the host resizes or the column tracks change (`table-drag-scroll.directive.ts:113-118`). The host `(scroll)` listener (`:84`) never fires, because the scroll happens on the inner `.et-table-scroller` and `scroll` does not bubble. A fixed-height table that gets its rows after mount (the usual async load) therefore never becomes drag-scrollable. Listen on `scrollElement()` and track `rows()` as well. S Verified. Re-rated from Medium: in the default layout the host is the scroller (`scrollElement()` falls back to the host, which has `overflow: auto`), so the host `(scroll)` fires and the first wheel or scrollbar scroll fixes the flag. Only the page-sticky-header layout never recovers.

## Sticky columns

- Medium: The offset effect reads `getBoundingClientRect()` inside a plain `effect` (`table-sticky-columns.directive.ts:117-214`). It re-runs only on a host resize or a `columnWidths()` change. A column with an `auto` or content-sized track changes width when the data changes, and the pinned offsets then stay stale. The effect also forces a synchronous layout during change detection. Move the measurement to `afterRenderEffect` (read phase) and track `rows()`. M Verified. The default track `minmax(<min>px, 1fr)` does not depend on content, so only a consumer `width` such as `'1fr'` or `'auto'` hits it.

## Other

- Low: `TableCellErrorTooltipDirective` calls `inject(TableComponent)` without `optional` in a field initializer (`table-cell-error-tooltip.directive.ts:26`). This runs before `injectTableFeatureHost`, so outside a table the user gets a `NullInjectorError`, not the labelled error 3501 that the comment promises. S
- Low: `afterEveryRender` in the skeleton directive has no phase, and it reads `getBoundingClientRect()` after every render of the application (`table-skeleton.directive.ts:60`). Use `{ read: ... }`, and stop once the table has rows. `TablePageStickyHeaderDirective.measure` writes a style from inside a `read` phase (`table-page-sticky-header.directive.ts:54`, `:77`). S
- Low: `DETAIL_ANIMATION_MS = 200` "must match the CSS", but the CSS animations run for 0.18s (`table-row-expansion.directive.ts:11`, `table-detail-styles.component.css:43`). S
- Low: The styling rules are not followed in three places. `:where(:hover, :focus-visible)` wraps interaction states that should stay bare (`table-expander-cell.component.css:34`, `table-resize-grip.component.css:35`). The ghost uses the hardcoded shadow colour `rgb(0 0 0 / 0.18)` (`table-reorder-overlay.component.css:39`). The chevron transition has no reduced-motion guard (`table-expander-cell.component.css:45`). S
- Low: Many comments fall outside the AGENTS.md allowlist: rationale and history text such as `table-csv-export.directive.ts:18-20`, `:107-108`, `table-inline-edit.directive.ts:388-390`, `table-selection.directive.ts:107-109`, `table-row-expansion.directive.ts:111-114` and `table-virtual-scroll.directive.ts:49-50`, and "which is why it is separate" sentences in public JSDoc (`table-filters.directive.ts`, `table-selection.directive.ts`). S

## Spec gaps

- Spec: No spec runs a feature in RTL (keyboard arrows, resize delta, reorder preview). S
- Spec: No inline-edit spec re-sorts or reorders while an editor is open (`table-inline-edit.directive.spec.ts`). S
- Spec: The drag-scroll spec has one case and does not cover a table that becomes scrollable after its rows arrive (`table-drag-scroll.directive.spec.ts`). S
