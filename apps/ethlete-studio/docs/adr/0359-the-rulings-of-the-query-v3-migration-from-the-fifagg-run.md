---
status: accepted
built: 088ef29fb
decided: 2026-11-05
source: plans/et-update-findings.md sections 9 and 10 (deleted in B597), the human's answers relayed through fifagg-frontend-c3 and fifagg-frontend-3d
---

# The rulings of the query v3 migration from the fifagg run

the human's answers while the fifagg frontend moved to query v3. Each is built.

- **Cross-host cookie:** `withPersistentAuth` shares the cookie across sibling hosts on load only (`cookie.domain`,
  e.g. `.fifa.gg`), with no live sync. The migration writes `cookie.domain` from the v2 `cookieDomain`. On a refresh 401
  the client re-reads the cookie and retries once with the fresh token before it deletes the cookie. Remember-me is not
  shared across hosts.
- **Refresh `maxAttempts`:** the default 8 stays. The docs name the reason and the migration scaffold writes
  `maxAttempts` explicitly.
- **Devtools:** the codemod always rewrites the legacy `QueryDevtoolsComponent` to the lazy entry point.
  `provideQueryDevtools()` mounts the panel itself with a dynamic import and the migrator removes
  `<et-query-devtools-lazy>` from templates. `/toggle` never imports `/lazy`.
- **Devtools under automation:** the devtools stay hidden when `navigator.webdriver` is true. The provider option
  `showInAutomation` turns them on again.
- **No V2 after the migration:** a `V2QueryClient` left after the migration is a migrator defect, not a supported
  state. The migration report flags it. The legacy `<et-query-devtools>` throws with the interop client by design.
- **Interop parity:** the interop client gets no v2 focus refetch, no blur polling pause and keeps `triggeredVia:
'program'` ("neuladen und polling pause wurde in jedem projekt deaktiviert"). It keeps its own order for `abort()`
  and `execute({ cancelPrevious: true })` in one tick; the specs pin it and the migration guide names it.
