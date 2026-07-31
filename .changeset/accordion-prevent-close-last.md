---
'@ethlete/components': minor
---

Accordion: add `preventCloseLast` to the group — collapsing the last open panel does nothing. Paired
with `autoCloseOthers` the group behaves like a radio set, exactly one section open at a time. It
gates the header's toggle only: `close()`, `closeAll()` and `[(isOpen)]` still collapse the panel, and
the header is deliberately not marked `aria-disabled` (the control works; only the collapse is
momentarily inert).
