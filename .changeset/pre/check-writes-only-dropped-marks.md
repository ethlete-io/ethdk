---
'@ethlete/cli': patch
---

`design check` writes only dropped ready marks and dropped direct-edit records into the tracked `ready.json` and `merged.json`; new or refreshed records stay in the gitignored stamp cache until `design ready` or `sketch merge`.
