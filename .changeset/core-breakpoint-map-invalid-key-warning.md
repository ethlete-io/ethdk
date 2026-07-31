---
'@ethlete/core': patch
---

Breakpoint inputs: warn in dev mode when a breakpoint map mixes valid and unknown keys. One bad key (a
`default` entry, say) makes the whole map inert — it becomes a plain value, which for an attribute binding
renders as `[object Object]` and does nothing — and that failed silently until now.
