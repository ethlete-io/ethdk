---
'@ethlete/eslint-plugin': minor
---

Add `no-effect-cleanup-return`: flags a cleanup function returned from `effect()` /
`afterRenderEffect()`, which Angular ignores — so the teardown silently never runs. Auto-fixes the
mechanical case to the `onCleanup` parameter; otherwise points at `inject(DestroyRef).onDestroy()`.
