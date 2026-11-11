---
'@ethlete/cli': patch
---

`design check` reports each request the design server refused as outside its Vite allow list as a `SERVE-DENIED <id>` problem and fails, instead of only logging it.
