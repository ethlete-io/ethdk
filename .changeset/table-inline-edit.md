---
'@ethlete/components': minor
---

Table: add `etTableInlineEdit` (`TABLE_INLINE_EDIT_IMPORTS`) - inline cell editing. Mark a column
`editable` and give it an `etTableCellEdit` template, whose context is the draft as a signal-forms
field, so any of the library's controls is an editor with a plain `[formField]` binding. Double-click
or `Enter` starts, `Enter` saves, `Escape` restores, `Tab` saves and moves on; `cellCommit` reports
`{ row, column, previous, next }` and the mutation stays yours.
