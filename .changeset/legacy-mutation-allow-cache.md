---
'@ethlete/query': patch
---

Fix `ET301` on every legacy interop mutation. `LegacyQuery.execute()` translates v2's single `skipCache` into
`allowCache: options.skipCache !== true` for **every** method, so any `legacyPost*` / `legacyPut*` /
`legacyPatch*` / `legacyDelete*` executed without an explicit `skipCache: true` reached the repository with
`allowCache: true` and threw "This request is uncacheable, but allowCache is set to true".

`allowCache` is never read on the uncacheable path - there is no cache entry to reuse - so the throw was purely a
guard against a mistake in hand-written code. It stays for that, and gains a
`silenceUncacheableAllowCacheError` opt-out on `QueryConfig`, which `createLegacyQueryCreator` sets alongside the
`silenceMissingWithArgsFeatureError` it already passed. The cache-key guard is unaffected.

Note that dropping `allowCache: true` in the interop instead would have silently made every legacy `GET` refetch,
since an absent `allowCache` means "do not reuse the entry" rather than "use the default".
