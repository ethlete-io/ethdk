---
'@ethlete/cli': patch
---

The shot route answers 400 to `source=app` with `surface`, `color`, `fill`, `scheme` or `scale`, which the app harness cannot draw, instead of ignoring them.
