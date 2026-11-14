---
'@ethlete/cli': patch
---

`et design check` no longer runs the OFF-CENTRE and DISABLED-INTERACTION rules: OFF-CENTRE took toolbars for one-line text boxes, and DISABLED-INTERACTION flagged loading buttons that keep their colours on purpose. `data-et-skip="OFF-CENTRE"` is still accepted and escapes nothing.
