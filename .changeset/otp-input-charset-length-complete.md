---
'@ethlete/components': patch
---

OTP input: a `charset` RegExp with the `g` or `y` flag no longer drops every other character, shrinking `length` (or narrowing `charset`) re-sanitizes the value already in the field, and `complete` now emits for a programmatic value too.
