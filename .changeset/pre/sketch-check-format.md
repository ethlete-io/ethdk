---
'@ethlete/cli': patch
---

`et design sketch check` and `sketch ready` now run the checkout's own Prettier over a variant and report each unformatted file, so an unformatted variant can no longer become ready or merge.
