---
'@ethlete/components': minor
---

`injectOverlayScrollBlocker().lock(document?)` locks page scroll outside any overlay and returns an idempotent release function. It shares one count per document with the modal-overlay locks, so a header menu or a third-party widget no longer needs the Angular CDK `BlockScrollStrategy`.
