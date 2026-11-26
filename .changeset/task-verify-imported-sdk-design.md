---
'@ethlete/cli': patch
---

`et design task --verify` now accepts a changed `libs/<lib>/design/**` file when the part imports it. A lib design file the part does not import stays outside the allowed files.
