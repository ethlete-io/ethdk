---
'@ethlete/query': minor
---

Close the gaps found while migrating a real workspace from the legacy client to v3:

- **Client-level headers.** `createQueryClient({ headers })` takes `HttpHeaders` or a function
  re-read on every request, so a signal can drive it. Per-query `args.headers` merge on top and win
  per name. `client.refreshQueriesInUse()` re-runs every bound `GET`/`HEAD`/`OPTIONS` (in-flight ones
  included) - the replacement for v2's `setDefaultHeaders({ refreshQueriesInUse: true })`.
- **`provider.setTokens(access, refresh)`** on the public bearer auth provider, for tokens issued
  outside it (SSO callbacks, native shells). Previously reachable only from inside a custom feature.
- **`logout()` now resets bound secure queries.** It already unbound their cache entries, but the
  query objects kept their `response()`, so a component mounted across a logout went on rendering the
  previous user until something called `reset()`.
- **Legacy `prepare()` failures are diagnosable.** Calling it without an injection context throws
  `ET950` naming the creator instead of a bare `NG0203`; calling it with an already destroyed injector
  returns an inert query and warns in dev mode instead of throwing `NG0205` from a view's cleanup
  phase. `createLegacyQueryCreator` takes a `name` for those messages.
- **Query-collection consumers accept real legacy queries.** `AnyQueryCollection` no longer pins the
  arguments type, so a `createQueryCollectionSignal` result is assignable to `*etQuery`,
  `queryStateErrorSignal` and `switchQueryCollectionState` without a cast.
- **`queryErrorMessages(error)` / `queryErrorMessage(error)`** flatten a `QueryErrorResponse` into
  displayable strings, and `emptyQueryArgs<TArgs>()` covers argless queries in generic code (auth
  registry `execute()` now takes no argument either).
- **`BearerAuthProviderOf<typeof ref>`** derives the exact provider type; `AnyBearerAuthProvider` no
  longer forces bracket access on `provider.queries` under `noPropertyAccessFromIndexSignature`.

`migrate-to-query-v3` got a precision pass:

- Renames are scoped to imports that actually resolve to the migrated symbol, so same-named type
  members, config properties and exports from unrelated packages are left alone; import aliases are
  preserved instead of dropped.
- `--projects` / `--include` migrate one app or library at a time.
- Unused imports (`def`, `AnyLegacyQuery*`, stale client symbols) are no longer left behind.
- Auth providers are scaffolded from the v2 `V2BearerAuthProvider` config instead of `queries: []`.
- Devtools are migrated rather than deleted: the per-client `provideQueryClientForDevtools` calls
  collapse into one `provideQueryDevtools()`, `QueryDevtoolsComponent` is re-imported from
  `@ethlete/components`, and `<et-query-devtools>` markup is left alone - both versions use that selector.
- New report tasks for dropped v2 client options, missing `provideHttpClient()`, `setDefaultHeaders`
  call sites and the auth import-cycle layout.
