---
'@ethlete/components': minor
---

Boolean and numeric inputs now coerce attribute values via `booleanAttribute` / `numberAttribute`,
so static values need no binding — `<et-tab disabled>`, `<et-textarea rows="6">`. Inputs where
`null`/`undefined` means "unset" (the slider's `min`/`max`, the overlay's `hasBackdrop`, …) are
deliberately left untransformed.
