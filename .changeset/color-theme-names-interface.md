---
'@ethlete/core': minor
'@ethlete/components': patch
'ethlete-studio': patch
---

Added the merge-only `EthleteColorThemeNames` interface (one `true` member per theme name), so several sheets can register theme names; the `tailwind-4-color-theme` generator now writes it and `EthleteColorThemeNameRegistry['name']` is deprecated but still read.
