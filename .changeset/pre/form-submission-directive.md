---
'@ethlete/components': minor
---

Forms: `[etForm]` submits a `<form>` through its signal form - no submit handler, no
`preventDefault()` - and an invalid attempt now lands the user on the first error via
`focusFirstInvalidField()`.
