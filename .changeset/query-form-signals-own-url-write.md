---
'@ethlete/query': patch
---

`defineQueryForm`: a committed value no longer changes type, and a `Date` no longer loses its milliseconds, one microtask after the form writes it to the URL.
