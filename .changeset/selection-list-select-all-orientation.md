---
'@ethlete/components': minor
---

Selection lists: add `<et-checkbox-group-select-all>` - the prebuilt tri-state select-all row, which
until now had to be hand-rolled around the headless `etSelectionListControl`. It is a real
`role="checkbox"` with `aria-checked="mixed"`, and takes its text from a new shared `selectAll` form
label.

Also add `orientation="horizontal"` to `et-checkbox-group` and `et-radio-group`, flowing the options
in a wrapping row while the label and error/hint block keep their own lines. The projected DOM is
unchanged - an option is still a direct child of the group.
