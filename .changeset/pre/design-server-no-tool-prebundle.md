---
'@ethlete/cli': patch
---

The design server no longer pre-bundles its own authoring modules (`@design-system`, `@design-system/kit`, `@design-explore`), so a cold start no longer reloads every frame when Vite finds one of them late.
