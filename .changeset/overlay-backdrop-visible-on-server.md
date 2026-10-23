---
'@ethlete/components': patch
---

An overlay backdrop gets its visible class at once on a server render, so it no longer ships at opacity 0 in SSR markup.
