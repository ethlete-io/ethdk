---
'@ethlete/cli': patch
---

The design render and completeness checks inspect frames in a Chromium of their own, started with
`--disable-frame-rate-limit`, so their settle waits no longer pace at 60 Hz. Screenshots and motion shots keep the
normal browser.
