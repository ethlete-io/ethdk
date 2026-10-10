# hunt-table — bug hunt 2026-10-10

Scope: `libs/components/src/lib/table` (virtual scroll, expansion, sorting, selection, sticky columns,
inline edit, keyboard nav), `libs/components/src/lib/grid`. Findings already in `table-grid.md`
(TG-01..TG-11) are not repeated. Checked against `git log` up to `7752f7cbf`.

Looked at and not reported: `sortRows` on null/NaN/invalid dates (fixed in `7aa08297e`), mixed
number/numeric-string values (numeric collation keeps them consistent), the virtual window clamp on
a data shrink (covered by `virtual-window.spec.ts:112`), stale selection keys for filtered-out rows
(documented, `table.md:985`), `aria-sort` on every key of a multi-sort (asserted on purpose in
`table.e2e.ts:417`), listener/rAF teardown in reorder, drag-scroll and the grid gestures (all
`takeUntilDestroyed` or cancelled in `onDestroy`).

| ID    | Sev    | Kind     | Decision | Title                                                                                                |
| ----- | ------ | -------- | -------- | ---------------------------------------------------------------------------------------------------- |
| HT-01 | Medium | bug      | no       | A virtualized table sets no `aria-rowcount` / `aria-rowindex`, so it announces the window size       |
| HT-02 | Medium | bug      | yes      | Virtual scroll + an expanded row: the view jumps by the detail height when the row leaves the window |
| HT-03 | Medium | bug      | yes      | Hiding a filtered or sorted column keeps its filter and sort applied with no visible control         |
| HT-04 | Medium | dx       | no       | A `sortable` column whose `value` returns an object sorts as a no-op, silently                       |
| HT-05 | Medium | bug      | no       | Grid `restoreState()` during an item's leave animation: the restored item is removed 200 ms later    |
| HT-06 | Medium | test-gap | no       | Keyboard navigation across a virtual window has no spec and no e2e                                   |

## HT-01 A virtualized table sets no `aria-rowcount` / `aria-rowindex`

Status: fixed

- Where: `libs/components/src/lib/table/table.component.html:174-190` (body rows), `:404` and
  `table.component.ts:294` (the element that carries `role="table"`/`"grid"`),
  `table-virtual-scroll.directive.ts:50-63`.
- Problem: `grep -rn 'rowcount\|rowindex' libs/components/src/lib/table` finds nothing. With
  `etTableVirtualScroll` on 10 000 rows only ~20 `role="row"` elements exist, so a screen reader
  announces "table, 21 rows" and "row 3 of 21" for row 4 812. The cell context already knows the true
  index (`rowVm.index`, `table.component.ts:1188`), it just never reaches the DOM. The same applies to a
  `rowsSource` page whose `total()` is known.
- Fix: while a row window is active (or a source reports `total()`), bind `aria-rowcount` on the
  table/grid element to header rows + `rows().length` (or the total), and `aria-rowindex` on every body
  row to `headerRowCount + rowVm.index + 1` (header rows get their 1-based index). Count the detail
  row (`role="row"`, `table-row-detail.component.ts:33`) or give it `aria-rowindex` too. Spec in
  `table-virtual-scroll.directive.spec.ts`: scrolled window, assert the attributes on the first
  rendered row.
- Breaking: no. Decision: no.

## HT-02 Virtual scroll + an expanded row: the view jumps by the detail height

Status: fixed (user decision: measure detail rows, count them in the window)

- Where: `libs/components/src/lib/internals/virtual-window.ts:132-150` (uniform `index * itemHeight`
  math), `table.component.html:304-307` (the detail row renders inside the window),
  `apps/docs/components/table.md:1615-1618` (says the two compose).
- Problem: the detail row's height is in the DOM only while its row is in the window, and in no
  padding. Input: 48 px rows, overscan 6, row 0 expanded with a 300 px detail. At `scrollTop = 335`
  the window starts at 0 and the viewport shows row ~1; at `scrollTop = 336` `start` becomes 1, row 0
  and its 300 px detail unmount, `paddingTop` is 48, and the viewport now shows row 7 - six rows skip
  under a 1 px scroll, and scrolling back up jumps back. The scroll height also changes by 300 px each
  time, so the thumb jumps. `scrollToIndex` (keyboard nav, `table-keyboard-nav.directive.ts` via
  `scrollRowIntoView`) is off by the sum of the expanded details above the target.
- Fix: either measure each open detail row (ResizeObserver on `.et-table-detail-row`) and feed a
  per-index extra height into the window (prefix sums for `start`/`paddingTop`/`scrollToIndex`), or
  throw/warn in dev mode for the combination and correct the docs. Decision: which of the two.
- Breaking: no. Decision: yes.

## HT-03 Hiding a filtered or sorted column keeps its filter and sort applied

Status: fixed (user decision: the column menu's Hide column clears the column's filter and sort)

- Where: `libs/components/src/lib/table/table.component.ts:979-990` (`rows()` filters and sorts by
  `this.columns()`, not the visible ones), `:1862-1874` (`setColumnVisible` leaves `sort`/`filters`
  alone), `table-column-menu.directive.ts:107`.
- Problem: filter "Role = Admin" from the role column's menu, then pick "Hide column" in the same menu.
  The rows stay filtered to admins, but the filter trigger and the sort arrow lived in that header and
  are gone; nothing on screen says why rows are missing. The quick filter already does the opposite and
  only searches visible columns (`visibleColumnRecord()`, `:986`), so the two filter paths disagree.
- Fix: decide the rule. Either drop a column's `filters`/`sort` entries in `setColumnVisible(key,
false)` (and through the source setters when a `rowsSource` is bound), or keep them and surface them
  (column chooser marks a hidden column that still filters/sorts). Spec: filter, hide, assert rows.
- Breaking: behavior change if the entries are dropped. Decision: yes.

## HT-04 A `sortable` column whose `value` returns an object sorts as a no-op

Status: fixed (new ET3514)

- Where: `libs/components/src/lib/table/headless/table-sort.ts:9-19`, `table.types.ts:192-205`.
- Problem: `{ value: (u) => u.address, sortable: true }` with no `sortValue` type-checks.
  `compare()` falls through to `String(a).localeCompare(String(b))`, i.e. `'[object Object]'` vs
  `'[object Object]'` = 0 for every pair. The header shows the arrow and flips `aria-sort`, the rows
  never move, nothing is logged. CSV export has a dev error for exactly this case (ET3513
  `UNSERIALIZABLE_EXPORT_VALUE`, `table-errors.ts:29`); sorting does not.
- Fix: in dev mode, when client sorting reads a non-`TableSortValue` (object, array, function) from a
  column without `sortValue`, throw/report a new `TABLE_ERROR_CODES` entry naming the column and
  `sortValue`. Optionally type `sortable: true` to require `sortValue` when `TValue` is not a
  `TableSortValue`.
- Breaking: no (dev-mode only). Decision: no.

## HT-05 Grid `restoreState()` during a leave animation removes the restored item

Status: fixed

- Where: `libs/components/src/lib/grid/headless/grid.directive.ts:712-737` (`removeItem` schedules
  `finalizeRemove` after `LEAVE_ANIMATION_MS = 200`), `:780-822` (`restoreState`).
- Problem: the host-items path cancels a pending leave for every incoming id (`:357-359`, fixed in
  `f28e38a30`); `restoreState` does not. Input: animations on, `grid.removeItem('a')`, then within
  200 ms `grid.restoreState(snapshotWithA)` (an undo, a "reset layout"). `a` is restored, still shows
  the leaving transition (`leavingIds` keeps it), and when the timer fires `finalizeRemove('a')` drops it
  again, compacts the restored layout and emits `layoutChange` - the restore is silently undone.
- Fix: at the top of `restoreState`, `cancelLeave(id)` for every leaving id (restored or not - a
  restore replaces the whole set; for ids absent from the state just clear the timer). Spec in
  `grid.directive.spec.ts` with fake timers: remove, restore, advance 200 ms, assert the item stays.
- Breaking: no. Decision: no.

## HT-06 Keyboard navigation across a virtual window has no coverage

Status: fixed (e2e on the virtualized keyboard story)

- Where: `libs/components/src/lib/table/table-keyboard-nav.directive.ts` (`focusCell` ->
  `scrollRowIntoView` -> `afterNextRender`, `gridCellFromEvent` using `renderedRowOffset()`),
  `table.component.ts:1652-1700`.
- Problem: `table-keyboard-nav.directive.spec.ts` never enables `etTableVirtualScroll`, and every
  keyboard test in `apps/storybook-e2e/src/table/table.e2e.ts:186-485` uses a non-virtualized story.
  The windowed path (ArrowDown off the last rendered row, PageDown, Ctrl+End to row 9 999, focus
  position after a scroll shifts `renderedRowOffset`) depends on index arithmetic between `rows()`,
  the window offset and `viewChildren` order that nothing exercises; a regression would land focus on
  the wrong row or nowhere.
- Fix: one e2e test on the virtualized story: Tab in, Ctrl+End, assert the focused cell is in the last
  row and `aria-rowindex` (HT-01) / text matches; ArrowUp back across the window edge.
- Breaking: no. Decision: no.
