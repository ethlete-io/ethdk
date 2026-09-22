---
'@ethlete/core': patch
---

`ColorInteractiveHasFocusDirective` (`[etColorInteractiveHasFocus]`) now resolves the theme's **base** accent while a descendant is `:focus-visible`, instead of the `-focus` variant. A container merely mirroring a child's focus (e.g. a form field's frame) should read as the plain accent color; the `-focus` variant remains reserved for an element that is itself focused (`[etColorInteractive]:focus-visible`). Effect: focused form fields now paint their focus border/label in the base accent rather than the focus-adjusted shade.
