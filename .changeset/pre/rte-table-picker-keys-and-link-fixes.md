---
'@ethlete/components': patch
---

Rich text editor fixes:

- The table size picker now supports arrow-key navigation (Enter/Space inserts the selected size, Escape/Tab close the menu from a focused cell).
- Toolbar buttons draw their focus ring on the button edge instead of 3px outside it, where it stacked on the field border and neighboring buttons.
- Applying a link with Enter no longer leaks a line break into the editor.
- Whitespace at the edges of the linked selection now stays outside the created anchor instead of being swallowed (e.g. the trailing space of a word selection).
