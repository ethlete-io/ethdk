---
'@ethlete/core': patch
---

`initials()` and the `initials` pipe take a whole character from each word, so a name starting outside the basic multilingual plane no longer yields half a surrogate pair, and a decomposed accent stays on its letter.
