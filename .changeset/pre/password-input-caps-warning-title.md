---
'@ethlete/components': patch
---

`et-password-input` shows its Caps Lock hint as a native `title` instead of a tooltip, so a password field no longer bundles the tooltip and overlay runtime (about 16 kB gz).
