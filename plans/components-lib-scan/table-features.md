# table features scan - open findings

Scan of `libs/components/src/lib/table/table-*.{ts,html,css}` (top level, specs excluded) from 2026-09-28. 0 High, 2 Medium, 0 Low, 2 Spec (after verification: 8 verified, 1 re-rated). Skipped: `table.component.*`, `headless/` (except the CSV serializer in `headless/table-csv-export.ts`, read for the formula-injection check), `testing/`, `stories/`. Read the CSS files only for layer, colour and interaction-state rules.

## Keyboard navigation / a11y

- Medium: The lead and trail cells (the selection checkbox and the expander button) have no `#bodyCell`, so the roving grid does not reach them. Their controls each stay in the Tab order (`table-select-cell.component.ts`, `table-expander-cell.component.ts`). With `etTableKeyboardNav` and `etTableSelection` together, the body is one Tab stop per row plus one, not the single Tab stop that the directive documents. The same applies to the `tabindex="0"` error icon (`table-cell-error-mark.component.ts:27`). M Verified. Lead cells carry no `#bodyCell` and no `tabindex`, and the `et-checkbox` keeps its own stop.
- Medium: The resize grip is `aria-hidden` and responds only to a pointer (`table-resize-grip.component.ts:26`), so a keyboard user cannot resize a column (WCAG 2.1.1). The column menu has "autosize" and "reset", but no resize step. Add a focusable `role="separator"` with arrow-key steps, or add a width step to the column menu. M Verified. The column menu's autosize is the only keyboard path to a width change.

## Spec gaps

- Spec: No spec runs a feature in RTL (keyboard arrows, resize delta, reorder preview). S
- Spec: No inline-edit spec re-sorts or reorders while an editor is open (`table-inline-edit.directive.spec.ts`). S
