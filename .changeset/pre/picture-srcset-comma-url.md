---
'@ethlete/components': patch
---

`et-picture` keeps a comma inside a srcset URL (e.g. `img.jpg?rect=0,0,100,100 1x`) when picking the fallback `src` and applying the `baseUrl`, instead of cutting the URL at the comma.
