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
