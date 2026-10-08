---
'@ethlete/core': patch
---

Peer dependencies are ranges (`^22.1.0` for Angular, `^7.8.0` for RxJS, ...) instead of the workspace's exact versions. `migrate-to-v5` now reports every dropped 4.x export, such as `ObserveResizeDirective` and `LetDirective`, with its successor.
