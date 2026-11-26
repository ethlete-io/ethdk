---
'@ethlete/core': minor
---

Dev mode throws `ET9200` when `provideColorThemesWithTailwind4()` gets two default color themes, and `ET9201` when `provideSurfaceThemesWithTailwind4()` gets two default surface themes of the same `type`. Both name the themes; production behaviour is unchanged.
