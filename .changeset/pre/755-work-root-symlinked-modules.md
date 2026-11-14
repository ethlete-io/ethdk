---
'@ethlete/cli': patch
---

The design tool keeps its shot cache inside the checkout when `node_modules` is a symlink to another tree, instead of writing into that tree's `node_modules`.
