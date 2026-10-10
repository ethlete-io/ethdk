# hunt-query-http — DX scan 2026-10-02

Scope: `libs/query/src/lib/http` (http-request, repository, cache key, retry, invalidation, optimistic update, execute, snapshot, sequence, submission), `lib/gql`, `lib/legacy` (request, interop). Auth, ws and query-form were skipped. QA-01..QA-14 were not repeated.

| ID    | Sev    | Kind     | Decision | Title                                                                                                |
| ----- | ------ | -------- | -------- | ---------------------------------------------------------------------------------------------------- |
| HQ-01 | Medium | bug      | no       | `keepUnusedFor` above 2^31-1 ms (or `Infinity`) evicts an unused entry after about 1 ms             |
| HQ-02 | Medium | bug      | no       | `executeUntilSettled` never settles when the execution is dropped as parked                          |
| HQ-03 | Low    | bug      | no       | Legacy `request()` sends a `URLSearchParams` body as `application/json` and a typed array as JSON map |
| HQ-04 | Low    | bug      | no       | Legacy `v2ExtractExpiresInSeconds` ignores `max-age=0` and `no-store`                                 |
| HQ-05 | Low    | bug      | no       | `gql` tag prints `false` into the document; GET transport cache key depends on variable key order     |
| HQ-06 | Medium | bug      | no       | An optimistic update is never rolled back when `repository.request` throws                            |
| HQ-07 | Low    | bug      | no       | Legacy `request()` shares `currentRetryCount` and `retryTimeout` across subscriptions                 |
| HQ-08 | Low    | test-gap | no       | Legacy XHR `request()` and `v2ExtractExpiresInSeconds` edge cases have no spec                       |

## HQ-01 `keepUnusedFor` above 2^31-1 ms (or `Infinity`) evicts an unused entry after about 1 ms

- Where: `libs/query/src/lib/http/query-repository.ts:505` (`Math.max(0, ...)` passes any number through) and `:697` (`setTimeout(() => evict(key, 'expired'), cacheEntry.keepUnusedFor)`).
- Problem: `createQueryClient({ keepUnusedFor: Infinity })` or `keepUnusedFor: 30 * 24 * 3600_000` (2.59e9) is the natural way to say "keep it for the session / a month". `setTimeout` treats a delay above 2^31-1 as 1 ms (checked: `setTimeout(fn, 2**31+5)` fired after 4 ms, with `TimeoutOverflowWarning`). The entry loses its response a moment after its last consumer unbinds, so back navigation shows an empty loading state, the opposite of what was asked. No spec covers a large value (`grep keepUnusedFor: Infinity` finds nothing).
- Fix: in `resolveKeepUnusedFor` clamp to `2 ** 31 - 1`, and in `retain` skip the timer when the value is `Infinity` (the unused-entry cap still bounds memory). Add a repository spec with `vi.useFakeTimers()` for `Infinity` and `2 ** 31`. Document `Infinity` in `CreateQueryClientConfigOptions.keepUnusedFor` and `apps/docs/query/caching.md`.
- Breaking: no. Decision: no.
- Status: fixed (timer skipped for `Infinity`, clamped to 2^31-1 otherwise; repository spec)

## HQ-02 `executeUntilSettled` never settles when the execution is dropped as parked

- Where: `libs/query/src/lib/http/query-snapshot-utils.ts:14-19` with `query-execute-utils.ts:116-126` (`skipParkedExecution`) and `query-snapshot.ts:75-103`.
- Problem: for a query with a `withArgs` source that returns `null`, `query.execute()` returns without a request (dev-mode warning only). `executeAndSettle$` then creates a snapshot whose state has `loading() === null`, no response event and no error. The kill effect only calls `settle()` on a Response event or an error, so `isAlive` stays `true`: `await executeUntilSettled(parkedQuery)` hangs forever and the `executeUntilSettled$` observable never emits or completes, and the snapshot effect leaks until the injector dies. Input: `const q = getUsers(withArgs(() => id() ? { pathParams: { id: id()! } } : null)); await executeUntilSettled(q);` with `id() === null`. A `querySequence` step or a `createQuerySubmission` over such a query hangs the same way, with `running()` stuck on `true`.
- Fix: have `exec` return whether it ran (or let `executeAndSettle$` check `query.executionState()` / a `state.subtle` flag set by `skipParkedExecution`) and, when nothing ran, settle with the destroyed-style cancelled snapshot (`createDestroyedSnapshot`) instead of waiting. Add a scenario in `libs/query/src/scenarios/abort-helpers.scenario.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed (execute returns `false` when parked; settles with an aborted-style snapshot rather than a cancelled error, matching `query.abort()`; scenario in abort-helpers)

## HQ-03 Legacy `request()` sends a `URLSearchParams` body as `application/json` and a typed array as a JSON map

- Where: `libs/query/src/lib/legacy/request/request.util.ts:99-120` (`serializeBody`) and `:140-170` (`detectContentTypeHeader`), used at `request.ts:46-52`.
- Problem: `serializeBody(new URLSearchParams('a=1'))` returns the object unchanged (XHR sends `a=1`), but `detectContentTypeHeader` skips only `FormData`, `Blob`, `ArrayBuffer` and strings, so a `URLSearchParams` falls into `typeof body === 'object'` and the request goes out with `Content-Type: application/json` and a form-encoded payload. Angular's `HttpClient` sets `application/x-www-form-urlencoded;charset=UTF-8` for the same body. A `Uint8Array` body is not an `ArrayBuffer`, so `serializeBody` runs `JSON.stringify` on it and sends `{"0":1,"1":2,...}` as JSON.
- Fix: return `'application/x-www-form-urlencoded;charset=UTF-8'` for `URLSearchParams`, `null` for `ArrayBuffer.isView(body)`, and pass `ArrayBuffer.isView(body)` through `serializeBody` unchanged. Extend `request.util.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed The legacy system is in maintenance, so this is a fix only if a consumer sends such bodies.

## HQ-04 Legacy `v2ExtractExpiresInSeconds` ignores `max-age=0` and `no-store`

- Where: `libs/query/src/lib/legacy/request/request.util.ts:45-93`.
- Problem: `max-age=0` gives `maxAge = 0`, which is falsy, so the code falls through to the `Expires` header: `Cache-Control: max-age=0` with `Expires: <far future>` caches the response for that long although the server said revalidate. `Cache-Control: no-store` is not checked (only `no-cache`), so a `no-store` response with `max-age=60` is cached for 30 s. The current `extractExpiresInSeconds` (`http/query-cache-utils.ts`) handles both.
- Fix: test `maxAge !== null` instead of truthiness, and add `no-store` to the early return. Add cases to `request.util.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed

## HQ-05 `gql` tag prints `false` into the document; GET transport cache key depends on variable key order

- Where: `libs/query/src/lib/gql/gql-transformer.ts:97-102`, and `gql-query-execute.ts:50-65` with `http/query-cache-utils.ts:50-72`.
- Problem (a): `gql\`query A { a ${showB && 'b'} }\`` with `showB = false` yields `query A { a false }`, a field named `false`, because `values[i] ?? ''` only drops `null` and `undefined`. A conditional fragment is the usual reason to interpolate. Problem (b): with the default `GET` transport the variables travel as `JSON.stringify(variables)`, an opaque string, so `sortQueryParamKeys` cannot sort inside it. `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` build two cache keys, two requests and two entries for one query. The POST transport sorts the body and is fine.
- Fix: (a) treat `false` like `null` (`values[i] === false || values[i] == null ? '' : values[i]`). (b) stringify variables with the same sorted replacer (`sortQueryParamKeys` or `sortObjectKeys`) in the GET branch of `transformGql`. Add cases to `gql-transformer.spec.ts` and `gql-query-execute.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed (unit specs + gql scenario)

## HQ-06 An optimistic update is never rolled back when `repository.request` throws

- Where: `libs/query/src/lib/http/query-execute-utils.ts:85-101` and `query-optimistic-update.ts:158-197`.
- Problem: `withOptimisticUpdate` hooks `beforeExecute`, which writes the guess into the cached reads. `queryExecute` calls it at line 85 and the returned rollback (`onRequest`) only after `repository.request(...)` succeeded (line 107). `repository.request` can throw before sending anything: `buildRoute` (`ET` invalid route, missing `pathParams` for a function route, `baseUrl` ending in `/`), or `uncacheableRequestHasCacheKeyParam`. Then the optimistic write stays on every matched read until a refetch, with no failed request to roll it back. Input: a `patchX(withArgs(() => ({ body })), withOptimisticUpdate({ ... }))` whose route function needs `pathParams` that the execute args omit. The user sees the wrong data and the thrown error.
- Fix: call `beforeExecute` and run `repository.request` in a `try`; on a throw call the rollback (have the hook return `{ onRequest, onError }`, or run `settle(null)` through a returned handle). Add a scenario to `caching-optimistic.scenario.spec.ts`.
- Breaking: no. Decision: no.
- Status: fixed (rollback hook called with `null` on a throw; scenario in caching-optimistic)

## HQ-07 Legacy `request()` shares `currentRetryCount` and `retryTimeout` across subscriptions

- Where: `libs/query/src/lib/legacy/request/request.ts:27-28` (declared outside `new Observable`) and `:82-87`.
- Problem: the returned observable is cold, but `currentRetryCount` and `retryTimeout` live in the closure of `request()`. Subscribing a second time (two subscribers, or an outer `retry`/`repeat`) starts with the count the first run left behind, so `v2ShouldRetryRequest` (`currentRetryCount > 3`) gives up early, and `retryTimeout` of the other run is the one cleared on teardown, which can leave a retry timer running for a closed subscriber.
- Fix: move both declarations inside the `new Observable(...)` callback next to `xhr`.
- Breaking: no. Decision: no.
- Status: fixed (covered by request.spec.ts)

## HQ-08 Legacy XHR `request()` and `v2ExtractExpiresInSeconds` edge cases have no spec

- Where: `libs/query/src/lib/legacy/request/request.ts` (no spec; only `request.util.spec.ts` exists next to it) and `request.util.spec.ts`.
- Problem: the retry loop, the XSSI prefix strip, the `status === 0` with body rule, Blob error bodies and teardown are only reached indirectly. `request.util.spec.ts` has no case for `URLSearchParams`, typed-array bodies, `max-age=0` or `no-store`, which are HQ-03, HQ-04 and HQ-07.
- Fix: add `request.spec.ts` with a fake `XMLHttpRequest` (retry then success, `cancel` on unsubscribe, a second subscription starting at count 0, 204, XSSI JSON, Blob error) and the util cases above.
- Breaking: no. Decision: no.
- Status: fixed (request.spec.ts with a fake XHR, util cases added)
