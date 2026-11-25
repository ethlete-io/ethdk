---
'@ethlete/components': major
---

Remove `--et-pip-window-z-index`: set the PiP window layer with `providePipWindowConfig({ overlayLayer })`, which sets its z-index and overlay layer together (default `2147483005`). The `pip-window-z-index` migration moves a literal value there.
