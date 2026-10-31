---
'@ethlete/cli': patch
---

`design complete` no longer reports the focus container of a composite widget (a `menu`, `listbox`, `tree`, `grid`, `tablist` or similar with `tabindex="-1"` or `aria-activedescendant`) as an undeclared control; its items are still checked.
