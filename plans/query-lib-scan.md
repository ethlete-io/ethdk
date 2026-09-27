# Query lib scan — settled decisions

Every finding of the 2026-08-19 scan of `libs/query` is fixed (git history has them). These
decisions were made on purpose. Do not re-open them.

## Settled - do not re-open

- A numeric `refreshStrategy` from 0 to 1 is a fraction of the token lifetime, and above 1 it is
  milliseconds. Neither is clamped, except that a negative value clamps to 0. Pinned in
  `auth-features.scenario.spec.ts` and `apps/docs/query/auth.md`.
- The cookie token is obfuscated with a per-origin key, not encrypted. A sibling subdomain cannot
  read it, so it skips auto-login and leaves the cookie alone.
- The legacy `QueryForm` keeps its BehaviorSubjects. The class is `@deprecated`.
- `activeFilterCount$` vs `activeFilterCount` and `defaultFormValue` vs `defaultValue` stay. Both
  pairs are in the migration table in `apps/docs/query/query-forms.md`.
- The Promise-based public APIs stay: `executeUntilSettled` (with its twin `executeUntilSettled$`),
  `QuerySequence.run`, `createQuerySubmission.action`, `whenPersistenceReady` and
  `clearPersistedQueries`. They exist for signal forms and `provideAppInitializer`.
- The cache key is a non-cryptographic 2x32-bit hash. Accepted.
- The legacy refresh cookie stays readable from JS, because the provider reads it back itself.
- Legacy `fallbackInjector`: the first app wins, with a dev warning.
- Devtools persisted override `ops` survive a reload on purpose.
- The devtools vault's cross-tab `storage` listener is never removed. There is one per page.
- A follower tab's snapshot-carrying `<key>Success` event fires locally with a dev warning. One
  logout raises `logout` in every tab: `user` once, `otherTab` in the rest.
- `destroy()` of a shared legacy query is not a bug.
- A GraphQL 200 with `errors` and no `data` fails with ET601.

## Scan 2026-09-27

All ten findings are fixed:

- 1, 4, 5, 7 (revocation, multi-tab revoke, SSR inertness): 836fa5775; a `revoke()` queued behind one in flight
  returns its own snapshot since a5f6645f9.
- 2, 8 (ngrx-toolkit args hashing and stale call args): a90529416, e147c9a73.
- 3, 9, 10 (manual execute args, `refreshInUse` tracking, `setResponse`): 1d1359f6a, 224fb266b; a manual
  `execute({ args })` no longer re-runs `withPolling({ executeInitially })` since 88799a0ad.
- 6 (legacy secure query `triggeredVia`): 76426b323, 204fade6c.
- Follow-up to d414289ef: a configured retry policy alone decides `retryState` (1787d3793).

Open risks:

- A queued revocation pair is not re-checked against the live tokens before it is sent.
- `refresh()` on a released ngrx handle only warns.
- `prep-for-query-v3` does not handle `export { CLEAR_QUERY_ARGS }`, shadowed names, or `withArgs` callbacks passed
  by reference.

## Scan 2026-09-27 wave 2

1. `createQuerySubmission` treats an aborted or superseded execution as success: `onSuccess(null)` runs and `submit()` resolves `true`
   (`http/query-submission.ts:88-97`, `executeUntilSettled` settles an abort with `error: null`). Scenario, confirmed.
2. `querySequence` pushes an aborted step as a success with a `null` response, so the next `mapArgs` gets `null` and throws, or the
   waterfall carries on after the user aborted (`http/query-sequence.ts:181-199`). Scenario, confirmed.
3. Two signal query forms on one route committing in the same tick: the landed navigation carries only the last form's `info`
   marker, so the other re-parses its own output via `applyFromUrl` (lossy: Date loses ms, spurious commit and refetch, pending
   debounce dropped) (`query-form-signals/query-form-signals.ts:614-634`, `911-924`). Scenario, confirmed.
4. `migrate-to-query-v3` client rename rewrites every same-named identifier in the workspace, whatever module it comes from: foreign
   imports, top-level shadowing declarations' uses, shorthand object keys (`generators/migrate-to-query-v3/query-client-migration.ts:801-894`,
   `renameVariables` ~310-365; `isShadowedByLocalDeclaration` stops before the SourceFile). Generator spec, confirmed.
5. Import rewrites lose modifiers: `updateImportsInFile` drops default imports and `import type` (`query-client-migration.ts:827-832`,
   also `shared.ts:62-66` `ensureNamedImports`); `pruneUnusedNamedImports` drops `type` (`rename-symbols.ts:209-213`,
   `cleanup-migration.ts:285`, used by ngrx migration via `ts-edits.ts:121`) - TS1484 under `verbatimModuleSyntax`. Generator spec, confirmed.
6. An aliased `QueryDevtoolsComponent as X` import keeps the legacy component while `provideQueryClientForDevtools` is replaced, so the
   component throws NullInjectorError on its non-optional token (`cleanup-migration.ts:171-208`, `272-275` compare the local alias).
   Generator spec for the output, runtime read; confirmed.
7. `.prepare()` -> `.prepare({})` is applied to any receiver in any file, no `@ethlete/query` import check
   (`cleanup-migration.ts:130-155`, `349-384`). Generator spec, confirmed.
8. Paged stack `isLastPageLoaded` is `false` for an empty result (`totalPages: 0`) and when `totalPages` shrinks: `===` instead of `>=`
   (`http/paged-query-stack.ts:370-374`). Infinite scroll shows a loader forever. Scenario, confirmed.
9. Paged stack `fetchNextPage()` while a page loads throws ET401 (dev) / returns `null`, contradicting `apps/docs/query/stacks.md:60`
   for `blockExecutionDuringLoading: false` (`paged-query-stack.ts:346-353`, `420-426`). Scenario, confirmed.
10. `createQueryBatch`: unsubscribing mid-run skips `settleRun`, so in-flight and queued items are never marked `cancelled`;
    `retryFailed()` then sends nothing and reports `success` at 25% (`http/query-batch.ts:480-488`, `499-510`). Scenario, confirmed.
11. The web socket client never reconnects after an `io server disconnect` or a middleware-rejected handshake (socket.io stops
    auto-reconnecting there); `isConnected` stays false forever and the rotated `auth` never reaches a handshake, against
    `apps/docs/query/ws.md` (`ws/web-socket-client.ts:351-356` ignores the reason). Read, likely.
12. The web socket client has no platform guard: on the server every SSR request opens a real socket.io connection and emits room joins
    until app destroy (`ws/web-socket-client.ts:188-205`, `405`), unlike the query client's `isPlatformBrowser` check. Read, confirmed.

Also seen, lower priority: `executeUntilSettled` on a destroyed query rejects with NG0205 (`query-snapshot.ts:48-79`);
`migrate-to-query-v3` overwrites `query-v3-migration-tasks.md` on each scoped run (`report.ts:107-108`); a DataCloneError in one body
drops the whole persistence batch and disables writes for the session (`persistence/query-persistence-indexed-db.ts:150-167`); test
fakes diverge: `installFakeBroadcastChannel` delivers on a microtask (`testing/multi-tab-test-utils.ts:70`), the socket double's
`disconnect()` fires no `disconnect` listener and keeps one listener per event (`testing/web-socket-test-utils.ts:87`, `94`), the
persistence fake's gated `read` sees later removals (`testing/persistence-test-utils.ts:102-111`).

### Wave 2 status

Fixed: 1-2 `8b306b7e2` + `66bf78fcf` (an aborted submission resolves with no form error); 3 `87ea260ed`; 4-7 `3a9faa92d`;
8-10 `db41bf850`; 11-12 `d4def7b9b`. Also seen: NG0205 `8b306b7e2`; task report overwrite `3a9faa92d`; DataCloneError batch,
broadcast/persistence fakes `f8872d309`; socket double `d4def7b9b`; docs `cd7e4beca`.

Fixed later in `5b0e7b1a8`: the module graph resolves `./file.js` and `baseUrl`, and an unresolvable workspace import of a
renamed client is renamed by name and reported; an unresolved empty `.prepare()` is reported in any file; the ws backoff resets once a
connection stayed up for 10 s (`RECONNECT_STABLE_AFTER`), so a connect-then-kick loop keeps doubling.

Open:

- Unsubscribing a batch run records the aborted in-flight items as `cancelled`, so `retryFailed()` resends mutations the server
  may already have applied.

## Scan 2026-09-27 wave 3

1. A `Date` in `queryParams` is dropped from the URL and the cache key: `buildQueryString` walks it as a plain object
   (`http/internal/request-route.ts:139-146`), so `withArgs(() => ({ queryParams: qf.value() }))` loses date filters. v2 `buildRoute` too. Spec, confirmed.
2. Legacy v2 cache key ignores `args.headers`: two `prepare()` calls differing only in `Accept-Language` share one query
   (`legacy/query-client/query-client.utils.ts:18-26`). Read, confirmed.
3. Legacy `InfinityQuery` freezes after a failed page: `_data$` combines `filterSuccess()` streams, and `nextPage()` advances past
   the failed page (`legacy/infinite-query/infinity-query.ts`). Read, confirmed.
4. Legacy polling dies for good when stopped while blur-paused: `stopPolling()` never resets `_isPollingPaused` (`legacy/query/query.ts`). Read.
5. Retries resend the first attempt's headers (stale bearer after a refresh): headers resolve once outside the retried stream
   (`http/http-request.ts:~495-530`). Read.
6. Devtools mocks never match a client whose `baseUrl` has a path (`/v1`): the match path strips only the origin
   (`devtools/query-devtools-mocks.ts:175-214`). Scratch spec, confirmed.
7. Batch item tombstones are capped per batch but the number of batch buckets is unbounded (600 after 30 batches)
   (`devtools/query-devtools-registry.ts:230-257`). Scratch spec, confirmed.
8. A root-path devtools override turns a `null` response into the override value while loading or failed
   (`http/query-state.ts:161`, `devtools/query-devtools-overrides.ts:103`). Scratch spec, confirmed.
9. `setupAuthTest().refresh` ignores `buildRefreshArgs` and always sends `{ body: { token } }` (`testing/auth-test-utils.ts:180-187`). Read.
10. False docs: `persistence.md:274` `first[2]` (no tuple); `queries.md:148` `triggeredBy()` is not `null` after
    `refreshQueriesInUse()`; "throws in dev mode" for misuse errors that throw in every mode (`features.md`, `http.md`, `caching.md`,
    `errors.md`, `auth.md`); `testing.md:124` `setupAuthTest` options; `ws.md:11` "tuple".

Also seen: persisted override ops are not validated on read (`query-devtools-override-persistence.ts:65-70`); the auth vault's
`storage` listener parses without a try (`query-devtools-auth-sessions.ts:327-332`).

Decisions: a `Date` in `queryParams` goes on the wire as `toISOString()` (what `JSON.stringify` and the cache key already use);
misuse errors keep throwing in every mode and the docs say "throws".

### Wave 3 status

Fixed: 1, 5, 8 `0971093ce`; 2 `cd6fa3743`; 3 `234c13f63`; 4 `708ab2ad6` + `d71def980` (the interop `LegacyQuery` had the same bug);
6 `cd178cd6d` + `d034b9246` (the mock target carries the client `baseUrl`); 7 (the 5 most recently settled batches keep their
tail, at most 100 item tombstones), 9 and both "also seen" items `cd178cd6d`; 10 `a1a480241` (plus the `Date` and retry-header
notes). The `triggeredBy()` claim in 10 was stale: a client-level refresh already resets it to `null`; `0971093ce` pins it.

Review: `0971093ce` also stopped a root override from applying to a response that settled as `null`; `6ff8005d1`
restores it. `33dc55e8a` adds scenarios for 6 and 7. Open: a legacy `InfinityQuery` whose last page (or first page)
failed reports `canLoadMore: false`, so a trigger gated on it cannot reach the new retry.

Open, needs a decision: a query cannot carry consumer `HttpContext` tokens (every request builds a fresh context); `queryParams`
key order is not canonicalised, so `{a,b}` and `{b,a}` are separate cache entries.

Decided 2026-09-27: the cache key sorts `queryParams` keys (nested too) in v3 and legacy v2, the URL keeps the written order,
`76d826b63`. `retryFailed()` never resends an item an unsubscribe aborted in flight (it stays `cancelled`; queued items
still resend), `7cad1d52f` - this closes the batch item under "Open" above. A legacy `[etInfinityQuery]` keeps
`canLoadMore: true` while the current page has failed or is retrying (a gated trigger that remounted would retry in a
loop), and a failed first page no longer reports `loading: true`, `15e02e006`. Consumer HttpContext tokens on queries:
not added. ea-frontend has 0 uses of HttpContext / HttpContextToken (checked 2026-09-27). Add them only when a consumer
needs one.
