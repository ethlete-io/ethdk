---
'@ethlete/core': minor
---

Theme generators: pick the default theme at generation time - `--defaultTheme=<name>` on `tailwind-4-color-theme` and `--defaultLightTheme=<name>` / `--defaultDarkTheme=<name>` on `tailwind-4-surface-theme` override any `isDefault` flags in the definitions, so apps sharing one theme definition set (e.g. in a monorepo) can each generate a different default.
