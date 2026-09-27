# Query lib scan - settled decisions and open questions

Every finding of the `libs/query` scans (2026-08-19, 2026-09-27 waves 1-3) is fixed; git history has them. A
future scan must not report the settled items again.

## Settled - do not re-open

- `refreshStrategy` from 0 to 1 is a fraction of the token lifetime, above 1 it is milliseconds. Only a negative
  value clamps (to 0).
- The cookie token is obfuscated with a per-origin key, not encrypted. The legacy refresh cookie stays readable
  from JS.
- The legacy `QueryForm` keeps its BehaviorSubjects (`@deprecated`). `activeFilterCount$` / `activeFilterCount` and
  `defaultFormValue` / `defaultValue` both stay.
- The Promise APIs stay: `executeUntilSettled`, `QuerySequence.run`, `createQuerySubmission.action`,
  `whenPersistenceReady`, `clearPersistedQueries`.
- The cache key is a non-cryptographic 2x32-bit hash. It sorts `queryParams` keys (nested too); the URL keeps the
  written order.
- A `Date` in `queryParams` goes on the wire as `toISOString()`.
- Misuse errors throw in every mode, not only in dev.
- Legacy `fallbackInjector`: the first app wins, with a dev warning. `destroy()` of a shared legacy query is fine.
- Devtools: persisted override `ops` survive a reload; the vault's cross-tab `storage` listener is never removed
  (one per page).
- Multi-tab: a follower's snapshot-carrying `<key>Success` event fires locally with a dev warning. One logout
  raises `logout` in every tab (`user` once, `otherTab` in the rest).
- A GraphQL 200 with `errors` and no `data` fails with ET601.
- `retryFailed()` never resends an item an unsubscribe aborted in flight; queued items still resend.
- A legacy `[etInfinityQuery]` keeps `canLoadMore: true` while the current page failed or retries.
- `withPolling({ executeInitially })` passes `triggeredBy: 'polling'`, also after an args change.
- No consumer `HttpContext` tokens on queries until a consumer needs one (ea-frontend has none).

## Open

- The type error for a missing `withArgs` has limits: a generic helper that calls `c()` errors,
  `const f: QueryFeature<X> = withArgs(...)` no longer counts as `withArgs`, and a spread hides a missing `withArgs`
  until ET100 at runtime. Accept, or tighten?
- A queued token revocation is sent without a check against the live tokens.
- `refresh()` on a released ngrx-toolkit handle only warns.
- `prep-for-query-v3` does not handle `export { CLEAR_QUERY_ARGS } from '@ethlete/query'`, shadowed local names,
  or `withArgs` callbacks passed by reference.
