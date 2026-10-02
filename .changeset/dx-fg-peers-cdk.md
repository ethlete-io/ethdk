---
'@ethlete/cdk': minor
---

Peer dependencies are ranges (`^22.1.0` for Angular, `^7.8.0` for RxJS, ...) instead of the workspace's exact versions. The test-only `vite` and `@analogjs/vite-plugin-angular` peers are gone. `migrate-from-cdk` lists app stylesheet `.et-*` selectors that no `@ethlete/components` class matches.
