---
'@ethlete/components': patch
'@ethlete/cdk': patch
'@ethlete/core': patch
'@ethlete/query': patch
---

Fix overlays and menus not opening on insecure origins (plain-HTTP pages served from a LAN IP rather
than `localhost`/HTTPS). The overlay strategies and menu positioning generated ids with
`crypto.randomUUID()`, which is `undefined` outside a secure context — so opening any dialog, sheet,
anchored overlay or menu threw and only the backdrop appeared. They now use a new `randomId()` helper
(`@ethlete/core`) that uses `crypto.randomUUID()` when available and falls back to `getRandomValues`
otherwise, so overlays/menus work over plain HTTP too (e.g. testing a dev server from a phone).
