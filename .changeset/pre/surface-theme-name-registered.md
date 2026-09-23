---
'@ethlete/core': patch
---

Type `SurfaceTheme['name']` as `RegisteredSurfaceThemeName`. An app that augments
`EthleteSurfaceThemeNameRegistry` now gets its theme definitions checked against the same union as
`etProvideSurface`, and the internal provider sync compiles again. Apps that register no names keep
plain `string`.
