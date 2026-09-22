---
'@ethlete/components': minor
---

Accordion: add `preventCloseLast` to the group - the header can no longer collapse the last open
panel, so paired with `autoCloseOthers` the group behaves like a radio set. `close()`, `closeAll()`
and `[(isOpen)]` still collapse it.
