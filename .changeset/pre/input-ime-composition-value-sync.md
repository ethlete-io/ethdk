---
'@ethlete/components': patch
---

`et-input` and `[etInputMask]` no longer write the native field while an IME composition is active, so a composition that starts right after a keystroke is no longer torn down.
