---
'@ethlete/cli': patch
---

`et update --from` rejects a version that is not one, such as `core@v5.0.0`, instead of running every migration of the package.
