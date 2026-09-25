---
'@ethlete/core': patch
---

The `provideX` functions from `defineProvider`, `defineRootProvider` and `defineStaticProvider` return `StaticProvider[]` instead of `Provider[]`. You can now spread them into a `StaticProvider[]`, for example into `Injector.create` or an overlay's `providers`.
