---
'@ethlete/core': patch
---

`RuntimeError` logs its `data` directly instead of deep-cloning it first, which keeps the clone
helper out of every package's baseline bundle.
