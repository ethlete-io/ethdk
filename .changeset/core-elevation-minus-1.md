---
'@ethlete/core': patch
---

The `tailwind-4-surface-theme` generator reads `elevation: -1` and fails, naming the theme, when a surface theme cannot be parsed, instead of dropping it with a warning.
