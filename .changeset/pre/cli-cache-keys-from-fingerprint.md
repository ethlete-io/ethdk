---
'@ethlete/cli': patch
---

`et design check` no longer reuses stale Tailwind class facts, SDK declarations or app file lists after a theme in a package, a missing template that appears, a tsconfig path or a same-mtime edit changes what they read.
