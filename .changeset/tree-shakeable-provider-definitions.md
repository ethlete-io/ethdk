---
'@ethlete/core': major
'@ethlete/query': major
'@ethlete/components': patch
'@ethlete/cdk': patch
---

DI: `createProvider` / `createRootProvider` / `createStaticProvider` / `createStaticRootProvider` /
`createLabels` are replaced by `defineProvider` & co., which return a definition you read with
`toProvideFn` / `toInjectFn` / `toToken`. `createQueryClient`, `createBearerAuthProvider` and
`createWebSocketClient` return the same definition instead of a `[provide, inject, token]` tuple.
Every `provideX` / `injectX` / token export keeps its name; run
`nx g @ethlete/core:migrate-provider-shape` for your own call sites. The tuple shape was unshakeable,
so this cuts the `@ethlete/components` import floor from 89.9 kB to 2.4 kB gz.
