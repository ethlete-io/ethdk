---
'@ethlete/query': major
---

Rename the following symbols to solve naming conflicts. Usages will be migrated. 

- `BearerAuthProvider` -> `V2BearerAuthProvider`
- `AnyQueryCreator` -> `AnyV2QueryCreator`
- `CacheAdapterFn` -> `V2CacheAdapterFn`
- `Query` -> `V2Query`
- `QueryArgsOf` -> `V2QueryArgsOf`
- `QueryClient` -> `V2QueryClient`
- `QueryClientConfig` -> `V2QueryClientConfig`
- `QueryConfig` -> `V2QueryConfig`
- `QueryCreator` -> `V2QueryCreator`
- `QueryState` -> `V2QueryState`
- `RouteType` -> `V2RouteType`
- `RouteString` -> `V2RouteString`
- `AnyQuery` -> `AnyV2Query`

Rename the following functions to solve naming conflicts. Usages will be migrated.

- `buildQueryCacheKey` -> `v2BuildQueryCacheKey`
- `extractExpiresInSeconds` -> `v2ExtractExpiresInSeconds`
- `shouldCacheQuery` -> `v2ShouldCacheQuery`
- `shouldRetryRequest` -> `v2ShouldRetryRequest`

