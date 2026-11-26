---
'@ethlete/components': patch
'@ethlete/cdk': patch
'@ethlete/core': minor
'@ethlete/query': patch
---

Overlays and menus now open on insecure origins (plain-HTTP pages on a LAN IP, not just `localhost`/HTTPS). Id generation used `crypto.randomUUID()`, which is `undefined` outside a secure context, so opening any dialog, sheet, anchored overlay or menu threw and only the backdrop appeared. A new `randomId()` helper in `@ethlete/core` uses `crypto.randomUUID()` when available and falls back to `getRandomValues` otherwise.
