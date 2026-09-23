---
'@ethlete/components': patch
---

OTP input: shrinking `length` at runtime no longer emits `complete` when the truncated value lands on the new length; only a write to the value completes it.
