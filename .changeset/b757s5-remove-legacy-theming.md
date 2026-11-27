---
'@ethlete/core': major
'@ethlete/components': none
'@ethlete/query-devtools': none
'@ethlete/agent-rules': patch
---

Removed the runtime color theming (`provideColorThemes`, `createThemeStyle`, `createTailwind*`), `inject{Error,Warning,Success}Theme` and `SurfaceTheme.colorTheme`/`semanticColorThemes`; `et update` migrates each.
