---
'@ethlete/cdk': patch
---

`<et-pagination>` reads the current url from `DOCUMENT` instead of `window`, so it no longer throws under SSR; `paginate()` accepts a `currentUrl` option for use outside a browser.
