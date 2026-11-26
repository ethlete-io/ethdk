---
'@ethlete/cli': patch
---

The design render check sends fewer calls to Chromium per frame: it skips an unchanged colour scheme or viewport,
finishes transitions in the settle call, and reads the unstyled pass and the font faces in one call.
