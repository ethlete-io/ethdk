---
'@ethlete/components': major
---

Breaking: `et-*-player-slot` exposes its handle as `controls` instead of `slotDirective`, with a read-only `currentPlayerId`; `injectStreamPlayerSlot()` returns it. `pipActivate()` / `pipDeactivate()` return `false` when they could not act, and report `ET1612` without `provideStreamPip()`.
