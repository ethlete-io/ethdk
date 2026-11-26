---
'@ethlete/cli': patch
---

`design` renders no longer fail with "exports is not defined": the CLI build again ships the frame runtime as source only, with no CommonJS copies next to it.
