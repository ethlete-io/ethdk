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

Open, best first. Not fixed.

1. `redirectOnSessionEnd` never fires with `withTokenRevocation`: the revocation effect sets
   `executionState` to `revocation` in the same flush, so the guard never sees `logout`.
   `lib/auth/auth-guard.ts:247`, `lib/auth/features/bearer-auth-token-revocation.ts:111`. Confirmed (scenario).
2. ngrx-toolkit: FormData, Date, Blob, Map or Set args all hash to `{}`, so a second upload re-sends the
   first body. `ngrx-toolkit/toolkit-call.ts:18-29`, `ngrx-toolkit/toolkit-handle.ts:88,128`. Confirmed (scenario).
3. `execute({ args })` on a query without `withArgs` never sets `args()` (stays `null`, snapshot too),
   and a bare `execute()` afterwards sends no body. `lib/http/query-state.ts:199`,
   `lib/http/query-execute-utils.ts:95`. Confirmed (scenario).
4. With multi-tab sync one logout revokes from every tab: followers run `logout('otherTab')` and
   `shouldRevokeFor` accepts every cause when `revokeOn` is unset (3 tabs, 3 POSTs).
   `bearer-auth-token-revocation.ts:94,139`, `lib/auth/internal/multi-tab-sync.ts:204`. Confirmed (scenario).
5. A second session whose logout lands while the first revocation is in flight is never revoked;
   `revokeWithTokens` returns the live snapshot and drops the new pair. `bearer-auth-token-revocation.ts:102`. Confirmed (scenario).
6. A secure legacy query that waits for a token reports its own load as `triggeredVia: 'auto'`: the
   recorded `executeTime` is the synthetic wait state's, not the request's.
   `lib/legacy/interop/legacy-query.ts:284-294,377-379`, `lib/http/secure-query-execute-factory.ts:190,263`. Confirmed (scenario).
7. Auth multi-tab sync and leader election are not inert on the server: Node has `BroadcastChannel`
   and `navigator.locks`, so each SSR render opens channels, posts to concurrent renders, arms the
   250/1500 ms timers and leaves `sessionStatus` `unknown` for 250 ms. `lib/auth/internal/multi-tab-sync.ts:139-151`,
   `lib/auth/internal/leader-election.ts:163-166,237`. Confirmed (read).
8. ngrx-toolkit: later `actionOptions.headers` are dropped and `args$` keeps the first caller's args;
   `call()` reuses the args captured at handle creation. `ngrx-toolkit/toolkit-handle.ts:88,126-129`. Confirmed (read).
9. Executions run by `refreshInUse` (invalidation, `refreshQueriesInUse`) never update
   `lastTimeExecutedAt()` or `triggeredBy()`, which keep the previous run's values (e.g. `'polling'`).
   `lib/http/query-repository.ts:724`. Confirmed (read).
10. `subtle.setResponse` writes into `rawResponse`, so with `transformResponse` the value is transformed
    a second time; the devtools response editor passes the displayed (transformed) JSON.
    `lib/http/base-query-factory.ts:127`. Likely.
