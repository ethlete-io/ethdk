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
