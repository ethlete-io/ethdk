---
'ethlete-studio': patch
---

A debug start of Studio builds only the CLI before the design server starts, not the bundled runtime with its `npm install`, which the dev server never used.
