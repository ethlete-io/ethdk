---
'@ethlete/components': patch
---

`et-otp-input`: A `length` below 1 or one that does not parse now falls back to 6 instead of rejecting every typed character.
`et-rating`: A negative or `NaN` value now reads as zero, and keyboard steps from a value between steps snap onto the step grid.
