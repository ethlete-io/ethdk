---
'@ethlete/cli': patch
---

`et design check --rules` reports `DIRECT-EDIT-PENDING` on a merged part whose files changed without a `merged.json` record, so pre-push and CI no longer let a stale merged hash through.
