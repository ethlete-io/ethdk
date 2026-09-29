---
'@ethlete/components': patch
---

`SelectionOptionDirective.labelId` is a plain string instead of a signal. Read it as `option.labelId`, not `option.labelId()`.
