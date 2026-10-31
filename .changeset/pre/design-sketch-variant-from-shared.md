---
'@ethlete/cli': patch
---

`et design sketch variant --from` keeps relative symlinks in the copied variant, so its `shared/` links point at the same files as the source variant.
