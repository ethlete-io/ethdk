---
'@ethlete/components': patch
---

`et-picture` leaves `blob:` and protocol-relative URLs alone when a `baseUrl` is set, keeps its loaded state when `sources` is replaced by an equal array, and picks up an image that finished loading before hydration.
