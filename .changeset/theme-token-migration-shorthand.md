---
'@ethlete/core': patch
---

`migrate-theme-token-names` now renames tokens in Tailwind `bg-(--et-…)` shorthand classes and inline `style` triplets, and renames a theme name only after a Tailwind color utility, so attributes such as `data-et-surface` stay unchanged.
