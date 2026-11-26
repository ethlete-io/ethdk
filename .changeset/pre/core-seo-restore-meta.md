---
'@ethlete/core': patch
---

A meta tag that was in the page before a binding took its selector (e.g. from `index.html`) now comes back once the last binding for that selector is released, instead of staying removed.
