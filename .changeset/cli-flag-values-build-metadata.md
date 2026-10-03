---
'@ethlete/cli': patch
---

`et release` and `et update` now report a value on a flag that takes none (`--force=false` used to force the release), and `et update` reports an empty `--tag=` or `--to=` instead of reading it as the target. Version comparison ignores build metadata, so `1.0.0+build-5` no longer ranks as a prerelease of `1.0.0`.
