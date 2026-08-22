---
'@ethlete/components': patch
---

`et-phone-input` now applies a `defaultCountry` that changes after the first render, so a
locale or geo lookup that resolves late is no longer ignored.
