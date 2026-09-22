---
'@ethlete/timetrack': patch
---

The e2e fake world serves seeded agent session logs, and its store now honours dedupe keys and keeps
cursors, so a collector's re-read behaves the way the real store makes it behave.
