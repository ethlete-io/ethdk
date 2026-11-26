---
'@ethlete/components': patch
---

`et-select`: a searchable single select with a custom value template (`etSelectValue`) now swaps the rich display for the option's editable plain-text label inside the search input while the field is focused (edit mode), and restores the rich template on blur. Keyboard editing is now at parity with a plain searchable single select - the label is selected on open, Backspace edits the visible text, and erasing it clears the selection. Previously the input stayed empty in this case, so a single Backspace silently deleted the whole selected value with nothing visible to edit.
