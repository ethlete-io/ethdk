---
'@ethlete/core': patch
---

The `tailwind-4-surface-theme` generator reads a negative `elevation` such as `-1`. A theme the generator cannot parse now rejects with the theme name instead of being skipped with a warning.
