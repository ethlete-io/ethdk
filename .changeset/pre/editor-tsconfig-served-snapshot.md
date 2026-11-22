---
'@ethlete/cli': patch
---

Point the base-system parts in a product's editor `tsconfig.json` at the installed `@ethlete/cli`, not at the running server's package snapshot, so two design servers no longer rewrite it in turns and force a Vite full reload each time.
