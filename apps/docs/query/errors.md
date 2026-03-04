# Error Reference

All runtime errors thrown by `@ethlete/query` use `RuntimeError` from `@ethlete/core`. Each error has a numeric code prefixed with `ET` in the message (e.g. `ET100: ...`), which makes errors easily searchable in logs.

## Query (0–99)

|  Code | Key                                 | When                                                             |
| ----: | ----------------------------------- | ---------------------------------------------------------------- |
| `ET0` | `QUERY_FEATURE_USED_MULTIPLE_TIMES` | A `with*()` feature was passed more than once to the same query. |

## Query Features (100–199)

|    Code | Key                                                                  | When                                                                                                                    |
| ------: | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ET100` | `WITH_ARGS_QUERY_FEATURE_MISSING_BUT_ROUTE_IS_FUNCTION`              | The route is a function but `withArgs()` was not provided.                                                              |
| `ET101` | `WITH_POLLING_USED_ON_UNSUPPORTED_HTTP_METHOD`                       | `withPolling()` used on a non-GET/HEAD/OPTIONS/GQL query.                                                               |
| `ET102` | `WITH_AUTO_REFRESH_USED_ON_UNSUPPORTED_HTTP_METHOD`                  | `withAutoRefresh()` used on a non-GET/HEAD/OPTIONS/GQL query.                                                           |
| `ET103` | `WITH_AUTO_REFRESH_USED_IN_MANUAL_QUERY`                             | `withAutoRefresh()` inside a query with `onlyManualExecution: true`. Set `ignoreOnlyManualExecution: true` to suppress. |
| `ET104` | `SILENCE_MISSING_WITH_ARGS_FEATURE_ERROR_USED_BUT_WITH_ARGS_PRESENT` | `withSilencedMissingArgsError()` was used but `withArgs()` is also present — they conflict.                             |

## Auth Provider (200–299)

|    Code | Key                                                  | When                                                           |
| ------: | ---------------------------------------------------- | -------------------------------------------------------------- |
| `ET207` | `AUTH_EXTRACT_TOKENS_RESPONSE_NOT_OBJECT`            | The token extraction response was not an object.               |
| `ET208` | `AUTH_EXTRACT_TOKENS_RESPONSE_MISSING_ACCESS_TOKEN`  | The response did not contain a string `accessToken` property.  |
| `ET209` | `AUTH_EXTRACT_TOKENS_RESPONSE_MISSING_REFRESH_TOKEN` | The response did not contain a string `refreshToken` property. |
| `ET212` | `AUTH_PROVIDER_FEATURE_USED_MULTIPLE_TIMES`          | A bearer auth feature was registered more than once.           |

## Query Repository (300–399)

|    Code | Key                                         | When                                              |
| ------: | ------------------------------------------- | ------------------------------------------------- |
| `ET300` | `UNCACHEABLE_REQUEST_HAS_CACHE_KEY_PARAM`   | A non-cacheable request was given a `key` option. |
| `ET301` | `UNCACHEABLE_REQUEST_HAS_ALLOW_CACHE_PARAM` | A non-cacheable request had `allowCache: true`.   |

## Paged Query Stack (400–499)

|    Code | Key                                                                | When                                                               |
| ------: | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `ET400` | `PAGED_QUERY_STACK_PAGE_BIGGER_THAN_TOTAL_PAGES`                   | Requested page exceeds total page count.                           |
| `ET401` | `PAGED_QUERY_STACK_NEXT_PAGE_CALLED_WITHOUT_PREVIOUS_PAGE`         | `fetchNextPage()` called before the current page finished loading. |
| `ET402` | `PAGED_QUERY_STACK_PREVIOUS_PAGE_CALLED_BUT_ALREADY_AT_FIRST_PAGE` | `fetchPreviousPage()` called when already on page 1.               |

## Query Stack (500–599)

|    Code | Key                                                       | When                                                               |
| ------: | --------------------------------------------------------- | ------------------------------------------------------------------ |
| `ET500` | `QUERY_STACK_WITH_ARGS_USED`                              | `withArgs()` was passed to a query inside a query stack.           |
| `ET501` | `QUERY_STACK_WITH_RESPONSE_UPDATE_USED`                   | `withResponseUpdate()` was passed to a query inside a query stack. |
| `ET502` | `QUERY_STACK_TOTAL_QUERIES_AND_EXPECTED_QUERIES_MISMATCH` | Query count mismatch — set `blockExecutionDuringLoading: true`.    |

## GQL (600–699)

|    Code | Key                                     | When                                                                                                  |
| ------: | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ET600` | `GQL_DATA_PROPERTY_MISSING_IN_RESPONSE` | The GraphQL response is missing the `data` property. Use `transformResponse` to handle custom shapes. |

## Secure Execute (700–799)

|    Code | Key                                           | When                                                                    |
| ------: | --------------------------------------------- | ----------------------------------------------------------------------- |
| `ET700` | `TOKENS_NOT_AVAILABLE_INSIDE_AUTH_AND_EXEC`   | A secure query attempted to execute before tokens were available.       |
| `ET701` | `INVALID_STATE_INSIDE_SECURE_EXECUTE_FACTORY` | An unexpected internal state was reached in the secure execute factory. |

## Query Execution (800–899)

|    Code | Key                         | When                                                                                  |
| ------: | --------------------------- | ------------------------------------------------------------------------------------- |
| `ET800` | `CIRCULAR_QUERY_DEPENDENCY` | A query was executed more than 5 times in under 100ms — likely a circular dependency. |
