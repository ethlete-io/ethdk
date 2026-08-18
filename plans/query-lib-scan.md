# Query lib scan — noteworthy findings

Scan date: 2026-08-19. Scope: all of `libs/query/src/lib` (about 28k lines of non-spec source).
Five parallel review agents read the source. Each agent verified its claims against the code.
Two agents also verified their top claims with throwaway specs (deleted after the run).

Severity counts: **9 high**, **21 medium**, **24 low**.

## Summary of the worst problems

1. `logout()` does not cancel an in-flight token query. A late response can restore the session. (auth)
2. `query-repository` never calls the stored `onDestroy` unregister function. Every poll tick leaks a closure. (http)
3. A duplicated unbind leaks an eviction timer. The timer can later destroy a live, in-use cache entry. (http)
4. The secure-query token-refresh subscription never unsubscribes. It can call `exec()` on a destroyed query. (http)
5. Half of the secure GQL creators send the wrong HTTP verb. `createSecureGqlQueryViaPost` sends GET with the payload in the body. (gql)
6. The websocket destroy hook leaves the room from a re-read `roomFn()`, not the room it joined. A never-flushed joiner can delete a live room. (ws)
7. The legacy 401 retry path never retries. The query stays in LOADING forever. (legacy)
8. Legacy `cleanUp()` calls `destroy$.unsubscribe()` instead of `complete()`. A reused provider can never store new tokens again. (legacy)
9. The refresh-token cookie is domain-wide, but its encryption key is per origin. A second subdomain corrupts and then deletes the shared session. (auth)

---

## auth

### High

- **`logout()` does not invalidate in-flight token executions — the session can resurrect itself.**
  `auth/bearer-auth-provider.ts:812-826` clears the tokens but does not bump `latestExecutionId` and does not cancel the query in flight. The supersession check at line 545 is the only guard. If a login, auto-login, or refresh is in flight when `logout()` runs, the effect at line 549 still calls `applyTokens()` when the response lands. The tokens come back, `sessionStatus` returns to `authenticated`, and `sessionEndCause` is cleared. An inactivity logout that races a scheduled refresh is the realistic case. No spec covers it.
- **The refresh-token cookie is domain-wide, but the encryption key is per origin.**
  `auth/features/bearer-auth-persistent-auth.ts:159` defaults the cookie domain to `getDomain()`, the registrable domain, so all subdomains share the cookie. The XOR key lives in `localStorage` (`auth/utils/token-encryption.ts:1-38`), which is per origin. On a second subdomain, `decryptToken` returns garbage with no integrity check (lines 63-69). Auto-login then sends a corrupt token, gets a 401, and deletes the shared cookie (`bearer-auth-persistent-auth.ts:199-204`). This kills the session on the first subdomain too.

### Medium

- **The cookie is written without `Secure`, so `sameSite: 'none'` cannot work.** `setCookie` (`libs/core/src/lib/utils/cookie.ts:20-46`) never emits `Secure`, but the config advertises `'none'` (`bearer-auth-persistent-auth.ts:50`). Browsers reject `SameSite=None` without `Secure`, so that config silently persists nothing. The cookie also travels over plain HTTP to every subdomain.
- **A numeric `refreshStrategy` is documented as a percentage but treated as milliseconds.** `auth/bearer-auth-query-builders.ts:52-57` documents "a percentage (0-1) of the token's lifetime", but `calculateRefreshBuffer` (lines 511-514) returns the number verbatim. `refreshStrategy: 0.75` schedules the refresh 0.75 ms before expiry. The `minBufferMs`/`maxBufferMs` clamps are also bypassed for the numeric form.
- **`tokenRefreshSuccess` has the wrong payload and fires too often.** `auth/features/bearer-auth-tracking.ts:265-270` emits `{ queryKey: 'refresh', snapshot: undefined }`, but the declared type is `{ automatic: boolean }` (lines 46-48). It also subscribes to `afterTokenRefresh$`, which fires for initial login and `setTokens` seeds, not only for refreshes.
- **Unsubscribed subscription in the tracking feature.** `bearer-auth-tracking.ts:265` subscribes to `afterTokenRefresh$` with no teardown. `context.destroyRef` is available and the channel at line 191 uses it.
- **The tracking BroadcastChannel has no provider namespace.** `bearer-auth-tracking.ts:182` opens `'ethlete-auth-tracking'`. Leader election (`internal/leader-election.ts:21`) and token sync (`internal/multi-tab-sync.ts:119`) both carry the provider name. Two providers on one origin cross-fire tracking events, and the message carries no provider identity to filter on.
- **Tracking events before the leader lock is granted are dropped.** `bearer-auth-tracking.ts:194-212` forwards to the leader when `isLeader()` is false. `isLeader` starts false until the Web Lock grant on a later microtask (`internal/leader-election.ts:40-44`). In that window a single-tab app posts to a channel where no tab is the leader, so the event is lost.
- **`<key>Execute` tracking events exist in the types but are never emitted.** `TrackingEventName` (lines 12-19) exposes them; `createTrackingFeature` only emits Success/Failure (lines 236-244). `trackedQueries`' `loading` field (line 218) is also written and never read.
- **Cookie deletion in `withPersistentAuth` depends on effect creation order across features.** `bearer-auth-persistent-auth.ts:186-205` keys the removal on the transient `executionState`. `withTokenRevocation` writes `{ type: 'revocation', state: 'loading' }` in reaction to the same token clearing (`bearer-auth-token-revocation.ts:79, 101-114`). If `withTokenRevocation` comes first in the feature list, the persistent-auth effect never sees `{ type: 'logout' }` and the cookie survives the logout. The next reload logs the user back in. No spec combines the two features.
- **`encryptToken` silently falls back to plaintext.** `token-encryption.ts:48-58` catches everything and returns the raw token, which then goes to the cookie and the BroadcastChannel. Realistic trigger: `generateEncryptionKey` reads `screen.width` behind a `navigator` guard (lines 4-7); modern Node defines `navigator` but not `screen`, so SSR throws there. Also, XOR against a key next to the ciphertext is obfuscation, not encryption; the API name suggests more.

### Low

- The refresh-timer overflow clamp only guards the `notLeader` reschedule (`bearer-auth-query-builders.ts:504-507`). The primary `timer(dueInMs)` path (lines 551-569, 596-597) is unclamped, so a lifetime over ~24.8 days fires immediately and then churns.
- `AuthQueryConfig.retryFn` is dead (`bearer-auth-query-builders.ts:22-26`); nothing reads it. `withRefreshQuery` sets retry behavior through `queryCreator.clone({ retryFn })`.
- A token-extraction failure on the refresh response never reaches `onRefreshFailure`. The effect at `bearer-auth-query-builders.ts:662-672` reads only `snapshot.error()`; the extraction failure lands in the separate `extractionError` signal (`bearer-auth-provider.ts:540, 563-569`). A 2xx refresh with an unusable body leaves a dead token until a 401 arrives.
- An anonymous tab acts on another tab's logout. `internal/multi-tab-sync.ts:187-192` calls `logout()` without a session check, so a tab that never logged in gets `sessionEndCause: 'otherTab'` and `unsavedChanges.abandonAll('logout')`.
- A `state-request` reply is broadcast, not addressed (`multi-tab-sync.ts:178-182`), and the receive path does not compare against `lastSyncedState`. Every resync makes all other tabs re-apply identical tokens and re-fire `afterTokenRefresh$`.
- `withTokenExpirationWarning` runs a 1 s interval forever, even with no session (`bearer-auth-token-expiration-warning.ts:52`). `combineLatest` also makes `expiresIn` stale for the first second after a token arrives.
- Two effects in `bearer-auth-provider.ts:549` and `:573` rely on Angular's effect creation order, which Angular does not guarantee. The comment at 547-548 admits this.
- Type surface problems: `sessionAdoption` (`bearer-auth-provider.ts:214, 446`) is typed with `BearerAuthSessionAdoption` from `internal/multi-tab-sync.ts`, which the barrel does not export. `TokenRefreshQueryBuilder.buildArgs` (`bearer-auth-query-builders.ts:245-250`) is a required member tagged `@internal`; `stripInternal` removes it from the published `.d.ts`.
- Stateful feature builders: `withBearerAuthMultiTabSync` mutates closure state during `earlySetup` (`bearer-auth-multi-tab-sync.ts:91-92, 111, 140`), so one builder value shared by two providers breaks the first. `createPersistentAuthFeature` and `createTrackingFeature` call `inject`/`effect` without an injector, so they only work inside an injection context.
- Nit in `auth-guard.ts`: `toObservable(settled)` registers on the root injector per pending navigation and is not released until app teardown. The guard logic itself is sound.

Clean: `internal/leader-election.ts`, `features/bearer-auth-inactivity-logout.ts`, and the auth guard's return-URL validation. No BehaviorSubject-for-state violations, no TODO markers.

---

## http

### High

- **The `onDestroy` unregister function is never called.** `http/query-repository.ts:716` — `bind()` runs on every `repository.request()`, cache hits included (line 511), so every `execute()` and every poll tick registers a fresh `onDestroy` closure. The unregister callback goes into `consumers` (lines 721, 725) and nothing in the repo invokes it. A query polled every 5 s accumulates one live closure per tick. On destroy, all of them run `unbind` for the same key.
- **A duplicated unbind leaks an eviction timer that can destroy a live cache entry.** `retain()` (`query-repository.ts:603-608`) assigns `cacheEntry.evictTimer` without a clear of the old one, and `unbind` (line 619) treats any call that finds zero consumers as a fresh transition. The duplicate unbinds from the finding above produce N `retain()` calls and N-1 orphan timers. `cancelEviction` (line 582) clears only the newest. An orphan later fires `evict(key, 'expired')` on an entry a new consumer uses: it cancels the in-flight request, deletes the entry, and completes `events$`, so `withSuccessHandling`/`withErrorHandling` go silent.
- **`tokenRefreshSubscription` outlives the query.** `http/secure-query-execute-factory.ts:207-219` subscribes to `merge(afterTokenRefresh$, error$)`. `afterTokenRefresh$` is a root-level Subject that never completes, there is no `takeUntilDestroyed`, and destruction of `deps.destroyRef` does not unsubscribe (only `reset()`/`exec()` do). Every destroyed secure query leaks one subscription for the app's lifetime. If the query died on a 401, a later refresh calls `exec()` on the destroyed query.

### Medium

- **A throwing `args` or creator permanently bricks a query batch.** `http/query-batch.ts:444-466` — `running` resets only inside `settleRun` (lines 421-422). If `mapArgs` or `queryCreator` throws inside `runEntry`'s `defer`, the stream errors, `running` stays true, `reset()` early-returns (line 514), and every later `run()` throws `queryBatchAlreadyRunning` forever. No `finalize` guards the outer stream.
- **Same shape in `QuerySequence.run()`.** `http/query-sequence.ts:149-198` — a throwing `step.produceArgs` (line 169) rejects with `running` still true, so every later `run()` throws ET900. No `try/finally`.
- **Per-request headers are not part of the cache key.** `http/query-cache-utils.ts:60-81` hashes only route + body; the caller passes headers (`query-repository.ts:477-484`) and the function ignores them. Two queries that differ only in `args.headers` (`Accept-Language`, tenant id) share one cache entry, so the second consumer gets the first one's response.
- **`writeArrayIndexes` writes index 0 for every element of an array of objects.** `http/internal/request-route.ts:124-136` — the index advances only when `processValue` returns true, and the object/array branches return null. Verified: `foo[0][a]=1&foo[0][a]=2` instead of `foo[1][a]=2`.
- **Bidirectional paging breaks with `blockExecutionDuringLoading: true`.** `http/paged-query-stack.ts:322-323, 345-352, 438-439` — for `direction === 'previous'`, `appendFn` reports the prepended query as `lastQuery`, so `maxPagination` describes the lowest page. After `fetchPreviousPage()`, `fetchNextPage()` silently returns null.
- **Page bookkeeping advances before the query exists.** `paged-query-stack.ts:391-395, 423-427` — `loadedMinPage`/`loadedMaxPage` are written, then `runWithArgs` can return null. The counters then disagree with `stack.queries().length`, which triggers ET502 in dev mode.
- **`resetExecuteState` unbinds `previousKey` but never clears it.** `http/query-execute-utils.ts:11-24` — after `reset()`, `query.id()` still reports a key the query is no longer bound to, and a second `reset()` unbinds the same key again. This is one trigger for the leaked-timer bug above.
- **An existing cache entry ignores the second consumer's configuration.** `query-repository.ts:718-722` — when a second consumer binds to an existing key, only `consumers` updates. `isSecure`, `isRefreshable`, `isMultiTabSyncEnabled`, `isPersistEnabled`, and `keepUnusedFor` stay as the first consumer set them. Only the `keepUnusedFor` case is documented. A query that opted out of persistence silently inherits the other's policy, and can survive `unbindAllSecure()` on logout.

### Low

- `http/http-request.ts:644` rounds before the ms conversion: `Math.round((total - loaded) / rate) * 1000` quantizes `remainingTime` to whole seconds. `query-batch.ts:349` does it correctly.
- `http/query-error-response.ts:67` always computes `retryState` with `retryCount: 0`, so a final error still reports `{ retry: true }`. `query-error.directive.ts:109-110` in components derives `canRetry` from it.
- The cache key is a 32-bit non-cryptographic hash of route + body (`query-cache-utils.ts:68-80`). A collision hands one query the other's response.
- `http/internal/request-route.ts:234` — `decryptBearer` logs the full bearer token to `console.error` on a parse failure.
- `http/observable-signal.ts:28` mutates the signal it receives via `Object.assign`, and each `asObservable()` call creates a new `toObservable` effect. A call in a template creates one per change-detection pass.
- `http/query-features.ts:226-228` — `executeInitially` bypasses the multi-tab poll lock; only the interval callback checks `hold.isHolder()` (line 233). Every tab does the first fetch.
- `query-cache-utils.ts:14-30` — `extractExpiresInSeconds` ignores `no-store`, and `max-age=0` falls through to the `expires` branch because 0 is falsy.
- Repo-rule note: `executeUntilSettled`, `QuerySequence.run`, `createQuerySubmission.action`, and `QueryClient.clearPersistedQueries`/`whenPersistenceReady` are Promise-based public APIs. They look deliberate (signal-forms `submit()` and `provideAppInitializer` want promises). Flagged so the deviation is a conscious one.

Clean: `sync/`, `persistence/`, `query-invalidation.ts`, error parsers, retry utils, `query-state.ts`, creator factories, `query-context.ts`. No TODO markers.

---

## query-form and query-form-signals

Relationship: `query-form-signals` is the successor. Both barrels are exported from `src/index.ts` with **no `@deprecated` tag anywhere**, though the docs treat the legacy classes as superseded. The two share only `query-form.utils.ts`.

### High

- **Legacy: an empty-string query param coerces to the number 0.** `query-form/query-form.ts:437` with `query-form.utils.ts:19` — `transformToNumber('')` returns 0. The everyday path reaches it: a cleared text input writes `?search=` (line 660-668 elides only defaults, which contradicts the `appendToUrl` JSDoc), and the navigation feeds `''` back in, so the input shows `0`. The signals version guards this (`query-form-signals.ts:79`).
- **Shared: `transformToNumberArray` drops a one-item selection on reload.** `query-form.utils.ts:29-37` handles arrays and numbers but not a string. Angular delivers `?ids=5` as the string `'5'`, so the transform returns null. All sibling transforms handle the string case. Affects both implementations.

### Medium

- **Legacy: `getDefaultValue` round-trips defaults through JSON**, so a `Date` default comes back as a string (`query-form.ts:573-576`). Resets write a string into a `FormControl<Date | null>`, and the just-reset field counts as an active filter.
- **Legacy: `skipNextResets` can latch.** It clears only in the `currentFormValue$` tap (line 318), which does not run when `handleFormChange` early-returns on an unchanged value (line 699). The next unrelated user change then skips the `isResetBy` graph. The signals `flush()` clears it on the equal-value path.
- **Legacy: `cleanup()` strips URL params even in read-only mode** (`query-form.ts:712-734`), it ignores `writeToQueryParams === false`. The signals version has the guard (`query-form-signals.ts:482`).
- **Both: the destroy-time param wipe runs in a `queueMicrotask` against whatever URL is then current.** `query-form.ts:725-733` and `query-form-signals.ts:490-492` call `router.navigate([])` with no `relativeTo`. When a navigation destroys the component, the outgoing page strips `page`/`search` off the incoming page's URL.
- **Legacy: `_syncViaUrlQueryParams` spreads the whole stale `queryParams` snapshot into the navigation** (line 646) next to `queryParamsHandling: 'merge'`. With two forms in the same tick, the second navigation reverts the first form's values.
- **Legacy: a `setValue` before `observe()` is lost from the public value** (`query-form.ts:266-285`). `qf.value` and the URL report defaults while the controls hold the written value. The signals `observe()` handles this with an unconditional `flush()`.
- **Signals: `appendDefaultValueToUrl: true` never writes on first load.** `query-form-signals.ts:377-405, 560-562` — `flush()` early-returns because `live` equals `committed`. Legacy gets this right. No spec covers the option.
- **Both: URL→form sync race on slow navigations.** `query-form-signals.ts:591-599, 446-474` — a form-initiated navigation that resolves after the next commit carries the previous value, and `commitFromUrl` reverts the model, fires a spurious commit, and then the newer navigation commits it back. Same shape in legacy at `query-form.ts:374-388`.
- **Signals: function defaults are not lazy, against their own JSDoc.** `query-form-signals.ts:49-63, 249` — `buildDefaults` runs once at definition time, so `defaultValue: () => new Date()` freezes. `resolveDefault` runs again in `deserialize` (line 292), so the two paths can disagree. This is also a behavioral regression versus legacy.
- **Signals: no normalization for a value whose `valueToQueryParam` returns null** (`query-form-signals.ts:377-405`; legacy normalizes at `query-form.ts:686-694`). The documented Sort case `{ active, direction: '' }` is committed, counted as an active filter, and dropped from the URL, so the state cannot be reproduced from its own URL.
- **Signals: `createBranch` leaks a field tree per filter-overlay open.** `query-form-signals.ts:120-138` — `form(model, { injector })` uses the injector captured at `defineQueryForm` time and creates a live effect on it. `filter-overlay.ts:111` calls `branch()` per overlay instance; nothing releases it on close. Unbounded growth for the page's lifetime.
- **Legacy: a missing `typeof` makes the boolean default check always false.** `query-form.ts:430` compares the default value against the literal string `'boolean'`. A field with default `false` that receives `?flag=1` gets the number 1 instead of `true`. The signals `autoCoerce` dropped the check entirely, so the two auto-transforms are not equivalent.

### Low

- Legacy holds synchronous state in three BehaviorSubjects (`query-form.ts:195-209`), against the repo rule. Worth an explicit `@deprecated` if it will not be converted.
- No legacy field class or `QueryForm` carries `@deprecated`, so editors give consumers no migration signal.
- `transformToDateArray` yields `[null]` typed as `Date[]` for an unparseable date (`query-form.utils.ts:75-83`); same shape for booleans at line 52.
- `transformToSort` produces `{ active, direction: undefined }` for `?sort=name` (`query-form.utils.ts:92-107`), which then serializes back as null.
- `transformToStringArray` drops empty strings in the array branch but keeps them in the single-string branch (`query-form.utils.ts:9-17`).
- Signals: a text field with `defaultValue: null` that the user clears holds `''`, counts as an active filter, and keeps a bare `?key=` in the URL (`query-form-signals.ts:90-99`).
- API asymmetry: legacy has `activeFilterCount$` only, signals has `activeFilterCount` only; legacy `defaultFormValue` vs signals `defaultValue`.
- `QueryFormOf` and `AnyQueryForm` have no internal use left (`query-form.types.ts:124`, `query-form.ts:165`).

Clean: `pipes/` — thin wrappers over pure lookup functions; the de/en duplication is intentional i18n content.

---

## devtools, ws, gql

### High

- **The websocket destroy hook leaves the wrong room.** `ws/web-socket-client.ts:244-251` re-evaluates `roomFn()` at destroy time instead of the room that was joined. Verified with a throwaway spec: (1) a joiner destroyed before its effect ever flushed never joined, yet the hook calls `leaveRoom`; `joinCount` drops to 0 and the server deletes the room, so a still-mounted joiner stops receiving messages. (2) If the room signal changed and the injector dies before the next flush, the hook leaves the new room; dev mode throws ET1000 from a destroy hook and the joined room leaks. Fix: track the joined name next to `roomData`.
- **Half of the secure GQL creators send the wrong HTTP verb.** `gql/secure-gql-query-execute.ts:60` derives the verb from `creatorInternals.method` (QUERY→GET, MUTATE→POST) and ignores `transport`, while lines 44-54 use `transport` to place the payload. `createSecureGqlQueryViaPost` puts the document in the body and then sends GET, so the payload never reaches the server. `createSecureGqlMutationViaGet` does the reverse. The non-secure path is correct (`gql-query-execute.ts:68`). No spec asserts the verb.

### Medium

- **The non-secure GQL execute mutates the shared args object.** `gql/gql-query-execute.ts:48-54` — `computedArgs` is the same object as `state.args()`, a cached `linkedSignal` value. A caller-supplied body on a POST-transport query is overwritten in shared state, and on re-execution the previous run's `query`/`variables` merge back over the new ones. The secure path copies; the two differ.
- **The `operationName` regex fails for most real documents.** `gql/gql-transformer.ts:3` requires a literal `(...)` plus exactly one space plus `{`, on one line. Verified: it returns no name for `query GetUser {…}`, multi-line variable lists, and `query X($a:Int){`. The specs pass only because they use invalid GraphQL (`query GetUser() { … }`, see `gql-transformer.spec.ts:94-127`).
- **The two default `transformResponse` implementations disagree.** A payload with no `data` key throws in the non-secure creator (`gql-query-creator.ts:47-53`) and passes through raw in the secure one (`secure-gql-query-creator.ts:25-30`).
- **`onAny` assumes a signature socket.io does not have.** `ws/web-socket-client.ts:64, 287` declares `(data: string) => void` and parses it; socket.io-client's catch-all invokes `(eventName, ...args)`, so with a real `io` every frame would hit `messageMalformed`. The test double mirrors the SDK's assumption (`testing/web-socket-test-utils.ts:53, 66-72`), so no spec can catch it. Confirm against the real server.

### Low

- Devtools override persistence grows without bound: `armedRecorders` and `ops` (`query-devtools-override-persistence.ts:52, 60, 91, 239`) are only pruned when a query's list becomes empty, never on query destroy.
- `provideQueryDevtools()` installs by side effect at call time and returns empty providers (`query-devtools-registry.ts:293-317`). A second call re-runs the init functions and clears loaded schema documents. Not idempotent.
- `join()` emits `join-room` before the existence check (`web-socket-client.ts:201-210, 275-284`), and socket.io's connect-time flush plus the `connect` handler re-emit, so each room joins twice on the first handshake. Harmless only against an idempotent server.
- `fitLength` in `query-devtools-schema.ts:367-376` grows a string with no ceiling; every other walk in the file is capped.

Clean: no reactive-rule violations in the three directories. Devtools cost-when-absent holds up: type-only imports, `@__PURE__` annotations, `sideEffects: false`, and the `window.ethlete` global installs only from `provideQueryDevtools()`.

---

## legacy (light pass; interop read closely)

Deprecation status: symbol-level coverage is essentially complete (209 `@deprecated … Intent to remove in v7` tags). Gaps are listed below.

### High

- **The 401 → refresh → retry path never retries; the query hangs in LOADING forever.** `legacy/query/query.ts:239-245` with `:517-528` — the 401 branch does not write the failure to the state, then calls `execute({ _isUnauthorizedRetry: true })`, which bails at the in-flight guard because `rawState` is still Loading and `cancelPrevious` defaults to false. Verified with a test: `execute` runs once, no request goes out, the state stays LOADING. Every expired-token response gives a permanently stuck spinner.
- **`cleanUp()` calls `destroy$.unsubscribe()` instead of `complete()`, and poisons the provider.** `legacy/auth/bearer-auth-provider.ts:90-98` — every later refresh still sends the request, but the `takeUntil(this.destroy$)` subscription errors, so new tokens are never stored and an `ObjectUnsubscribedError` escapes. Verified. Hit by any app that reuses one provider across logout→login (`query-client.ts:145-151` cleans up the previous provider on `setAuthProvider`).

### Medium

- **The `header` getter interpolates a null token: `Authorization: Bearer null`.** `legacy/auth/bearer-auth-provider.ts:62-64`, no guard. Combined with `query/query.utils.ts:439-458` (the header attaches to any query that merely omits `secure`), the malformed header goes out on most requests.
- **The refresh token sits in a JS-readable cookie with no `Secure` attribute, on the registrable domain.** `bearer-auth-provider.ts:197-208` with `libs/core/src/lib/utils/cookie.ts:20-46`. Shared with every sibling subdomain, sent over plain HTTP. `cookieSameSite: 'none'` is unusable without `Secure`.
- **A child client leaks the parent's bearer token to a different host.** `legacy/query-client/query-client.ts:192-194` plus `query.utils.ts:451-455` — the header is only withheld when `secure === false` is explicit. A child client with a third-party `baseRoute` sends the main API's token for every query that forgot `secure: false`.
- **`QueryStore` crashes SSR.** `legacy/query-store/query-store.ts:86-87` runs `fromEvent(window, …)` in the constructor (also `window.setInterval` at line 161), and `query-client.ts:179-186` constructs it unconditionally. Any SSR build that instantiates a legacy client crashes at bootstrap.
- **`validateWithV2Query` with a `createLegacyQueryCreator` wrapper always fails instead of validates.** `legacy/validate-with-v2-query.ts:111-117` — Angular invokes a `resource` loader outside an injection context, so `prepare()` throws ET950 unless `provideLegacyPrepareFallback()` is installed, and the thrown error becomes a bogus form-level server error. With the fallback installed, each prepared query binds to the root injector and never dies: one leaked query per debounced validation. The spec uses a DI-free fake and cannot catch this.
- **`InfinityQuery.reset()` drops pages without a stop of their polling or a destroy.** `legacy/infinite-query/infinity-query.ts:173-188` with `:163-164`; the directive's input setter (`directives/infinity-query.directive.ts:104-117`) builds a new `InfinityQuery` per config change with no teardown of the old one. With an interop creator the orphans are full new-system queries that never get `destroy()`ed.

### Low

- The parent fallback in `authProvider$` is dead code (`query-client.ts:195-197`): `asObservable()` is never nullish, so `??` never runs. A child client's `authProvider$` emits null.
- Container dependent tracking degenerates for non-node injectors: `data.utils.ts:91-92` uses `tNode?.index ?? -1`, so environment injectors share key -1 and `_hasDependents()` can wrongly report true, which skips `abort()`/`stopPolling()`.
- A token without the configured `exp` claim throws inside the refresh `tap` (`bearer-auth-provider.ts:236-238, 180`); the subscription at line 192 has no error handler, so all further scheduled refreshes silently stop.
- The legacy devtools component reports the wrong `refreshBuffer` default: `'30000 (default)'`; the real default is 300000 (`bearer-auth-provider.ts:233-234`).
- Undeprecated internals leak into the public API only via the legacy barrel: `request/request.util.ts:4-11` (`buildRoute`, `buildQueryString`, `buildTimestampFromSeconds`, `isEmptyString`, `isNaN`), `auth/auth-provider.utils.ts:25` (`decryptBearer`), `logger/logger.ts:4-8`. `isNaN` as a package export is a name-collision hazard.
- `legacy/interop/legacy-prepare-fallback.ts:14` — `fallbackInjector` is a module-level global; two apps on one page share the slot and the last boot wins.

### TODO/FIXME

- `legacy/entity/entity.utils.ts:13` — `// FIXME: This breaks if SubStoreType is an array`, no issue link, on the exported `insertFrom`. Accurate: the two `Array.isArray(ids)` branches at lines 38-42 are byte-identical, so the array case was never implemented.
- `legacy/directives/infinity-query.directive.ts:98-99` — leftover signal-input migration TODO, informational only.

Clean: `interop/` itself is the best-tested part (33 specs, inert-query and `destroyOnResponse` teardown covered); no race or leak inside the wrapper. The problems above sit at its edges.

---

## Cross-cutting themes

1. **Effect-order coupling.** Both the new auth provider (two internal effects) and the feature combination `withTokenRevocation` + `withPersistentAuth` rely on Angular's effect creation order. One helper or an explicit sequencing primitive would remove the class of bug.
2. **"Running" flags without `finally`.** `QueryBatch`, `QuerySequence`, and (in spirit) the legacy 401 retry all get stuck because a flag resets only on the happy path.
3. **Cookie handling.** `setCookie` in core cannot emit `Secure`, which breaks `SameSite=None` in both auth stacks and sends refresh tokens over plain HTTP. Fix once in `libs/core/src/lib/utils/cookie.ts`.
4. **Config that shares a cache key is first-writer-wins.** Headers are absent from the key, and the second consumer's `isSecure`/persistence flags are ignored. Both deserve a decision: include in the key, or merge policies.
5. **Missing `@deprecated` on the legacy `QueryForm` classes**, while the legacy folder itself is fully tagged. The docs already treat `defineQueryForm` as the successor.
6. **Test doubles that mirror the bug.** The websocket test double and the GQL transformer specs encode the same wrong assumption as the source, so the suites pass. When one of these is fixed, fix the double in the same change.
