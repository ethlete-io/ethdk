---
'@ethlete/cli': patch
---

The design CLI writes the editor `tsconfig.json` of each sketch variant in the checkout's Prettier format without a Prettier process per file, so a product with many sketches no longer slows the design server down.
