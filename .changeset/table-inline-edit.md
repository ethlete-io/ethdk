---
'@ethlete/components': minor
---

Table: add `etTableInlineEdit` (`TABLE_INLINE_EDIT_IMPORTS`) - inline cell editing. Mark a column
`editable` and give it an `etTableCellEdit` template, and the cell swaps to that editor while it is
being edited. The template gets the draft as a **signal-forms field**, so any of the library's
controls is an editor with a plain `[formField]` binding - there is no cell-editor interface.
Double-click or `Enter` starts, `Enter` saves, `Escape` restores, `Tab` saves and moves on; one cell
is open at a time. `cellCommit` reports `{ row, column, previous, next }` - the mutation stays yours,
and you drive the cell's pending/error look through the table's existing `cellState`.
