---
'@ethlete/components': patch
'@ethlete/contentful': patch
'@ethlete/query': patch
'@ethlete/core': patch
'@ethlete/cdk': patch
---

Mark build-tooling peer dependencies (`vite`, `typescript`, `ts-morph`, `@nx/devkit`, `@analogjs/*`) and feature-scoped runtime peers (`date-fns` in components) as optional via `peerDependenciesMeta`. They are only needed when running the Nx generators or using the date/time components - consumers no longer have to install them just to use the libraries.
