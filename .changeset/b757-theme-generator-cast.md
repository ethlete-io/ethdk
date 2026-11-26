---
'@ethlete/core': patch
---

The `tailwind-4-color-theme` and `tailwind-4-surface-theme` generators now read a theme whose properties carry a type cast, such as `name: 'farn' as ColorTheme['name']`, instead of skipping the theme.
