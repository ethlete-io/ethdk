# Multi-tab sync for @ethlete/query

**Status (2026-07-31): done.** All six phases shipped; docs live at
`apps/docs/query/multi-tab.md`. Size: M–L.

**Deviation from the plan:** §2 recommended shipping opt-in (default off); the default was
flipped to **on** on the user's call after the implementation landed, making the changeset
`major` rather than `minor`. `multiTabSync: false` is the opt-out, per client or per query.

Implementation notes worth keeping:

- The poll lock namespace is keyed off the **channel name**, not the client name —
  the channel is what says "these clients are the same client in different tabs",
  so the locks have to agree with it (`query-client.ts`).
- The repository event carries `isCached` / `isMultiTabSyncEnabled`; `isCached` is
  what separates a shareable read from a mutation, and it also replaced
  `shouldCacheQuery(method)` as `refreshInUse`'s guard so GQL-over-POST reads are
  refreshed (they were silently skipped before).
- Two-tab tests are two query clients sharing one `channelName`, over the fakes in
  `libs/query/testing/multi-tab-test-utils.ts` — jsdom's `BroadcastChannel` never
  delivers across instances and it has no `navigator.locks` at all.

Still open, as planned: the follow-ups in §6 (offline persistence, migrating the
auth leader election onto `KeyLockManager`, `client.invalidateQueries()`).

Cross-tab coordination for the signals-first query client (the current
generation only — the legacy `V2QueryClient` is out of scope). Two user-facing
outcomes drive everything:

1. **Polling dedup** — the same page open in two tabs must not poll twice _when
   it is safe not to_ (i.e. when the suppressed tab still receives the data).
2. **Cross-tab data propagation** — updating player A in tab 1 causes the
   player list in tab 2 to refresh, and a detail view of player A in tab 3 to
   show the new data.

Prior art in this repo: the bearer auth provider already does multi-tab sync
(`libs/query/src/lib/auth/internal/multi-tab-sync.ts` — token/logout broadcast)
and leader election (`leader-election.ts` — BroadcastChannel + localStorage
heartbeats) with the `multiTabSync: boolean | options` config pattern. This
plan follows that pattern but does **not** reuse the auth leader election —
see §3.2 for why per-key Web Locks fit polling better than a global leader.

## 1. Design — three capabilities, one foundation

### 1.1 Response sharing (the foundation)

When a cacheable request (`GET`/`HEAD`/`OPTIONS`, incl. cacheable GQL) settles
successfully in one tab, broadcast `{ cacheKey, body, expiresAt }` on a
per-client `BroadcastChannel`. A receiving tab that holds a cache entry for the
same key applies the response directly to its `HttpRequest`.

Why this works with near-zero plumbing:

- Cache keys are deterministic across tabs — `buildQueryCacheKey` hashes the
  route plus args (`query-cache-utils.ts`), and both tabs run the same app
  code. Same query in two tabs ⇒ same key.
- The repository already emits exactly the right event: `events$` fires
  `{ type: 'request-success', key, request }` per settle
  (`query-repository.ts:427`), and `request` carries `method`, `url`,
  `response()` and `expiresAt()`. The broadcast side is a plain subscription.
- Propagation to query objects is automatic: `QueryState.rawResponse` is a
  `linkedSignal(() => request()?.response() ?? null)` (`query-state.ts:85`), so
  writing the request's `response` signal updates every bound query, its
  `executionState`, and every `computed`/template downstream.
- Sharing `expiresAt` keeps freshness semantics intact: an entry updated from
  another tab is _fresh_, so a remount/auto-execute with `allowCache` in the
  receiving tab serves it without a network hit. Two tabs navigating the same
  app stop duplicating even non-polled fetches, opportunistically.

What it needs:

- **`HttpRequest` internal setter** — something like
  `subtle.applyExternalResponse({ body, expiresAt })` on the request object
  (`http-request.ts`): sets `response`, `expiresIn`, clears `error`. It must
  **not** emit on `events$` — that stream is "this request settled over HTTP",
  and repository `request-success` (which would re-broadcast → loop) hangs off
  it. Consequence, to document: side-effect features (`withSuccessHandling`,
  `withLogging`) do not fire for responses that arrived from another tab.
  Signals-driven UI updates regardless. (Revisit if a real need appears.)
- **Repository method** `applyExternalResponse(key, body, expiresAt)` that
  looks up the entry and forwards to the request. Rules:
  - Entry not present → ignore. We do not seed cold entries (unbounded memory,
    and nobody is looking at them).
  - Entry currently `loading()` → skip; the in-flight local request is at least
    as fresh and will overwrite anyway.
  - Unused entries sitting out their `keepUnusedFor` window **do** get updated
    — it is cheap and means back-nav renders data that is current, not merely
    recent.

Payload notes: `BroadcastChannel` structured-clones the body. JSON bodies are
fine; `blob`/`arraybuffer` response types clone too but are heavy — a
per-creator opt-out (see config, §2) covers pathological cases (huge lists
polled every second across many tabs).

### 1.2 Polling dedup

`withPolling` currently `setInterval`s `context.execute({ args })`
(`query-features.ts:177`), and that execute path **bypasses freshness** (no
`allowCache`), so suppression cannot come from shared `expiresAt` alone — it
must happen inside the polling feature: a tick that this tab is not
responsible for is simply skipped.

**Election is per cache key, via the Web Locks API** — not a global tab
leader:

- A global leader (the auth approach) is wrong here: the leader tab may not
  even have the query mounted that a follower tab is polling. Responsibility
  has to be scoped to "tabs that poll this exact key".
- `navigator.locks.request('et-query-poll:<client>:<cacheKey>', lock => …)`
  gives exactly that, with the hard problems solved by the platform: the
  holder polls; other tabs' requests queue (FIFO); when the holder closes,
  crashes, or navigates away, the lock releases and the next tab takes over
  seamlessly. No heartbeats, no localStorage, no split-brain windows.
  Support is universal in our targets (Chrome 69+, Firefox 96+, Safari 15.4+).

Behavior in the polling feature (it has everything it needs already —
`deps.client` for the sync engine, `execute.currentRepositoryKey` signal for
the key, and its args effect for lifecycle):

- Sync disabled / no `navigator.locks` / SSR → current behavior, every tab
  polls.
- Enabled: on args settling, request the lock for the current key. While _not_
  holding it, the interval still runs but each tick is a no-op (cheap, and it
  keeps `executeInitially`/interval semantics identical for when leadership
  arrives). While holding it, tick normally; results reach follower tabs via
  response sharing (§1.1).
- Args change ⇒ key change ⇒ release the old lock request, acquire for the new
  key. Query destroyed ⇒ release (aborting a pending `locks.request` needs an
  `AbortController` — part of the lock-manager wrapper).
- **"Safe to do so"** is enforced structurally: dedup is only active when
  response sharing is on for that entry (client + creator level). If sharing is
  off, every tab polls, as today.

Edge cases to handle/document:

- **Background-tab timer throttling.** If the lock holder is a hidden tab, its
  `setInterval` gets throttled (to ~1/min after a while) and the _visible_
  follower starves. Mitigation: on `visibilitychange` → hidden, the holder
  finishes its tick, releases the lock and immediately re-requests it — FIFO
  puts it behind any visible tab waiting; if nobody else wants the key it gets
  it right back. Symmetrically no action is needed on becoming visible.
- **Different intervals for the same key** in different tabs: the holder's
  interval wins. Document; not worth a negotiation protocol in v1.
- **Version skew across tabs** (old deploy still open next to a new one): keys
  or response shapes may differ. Message envelope carries a protocol version
  (library constant); unknown versions are ignored. Shape skew within the same
  protocol version is accepted risk, same as the auth sync today.

### 1.3 Mutation-driven cross-tab refresh

When a mutation (`POST`/`PUT`/`PATCH`/`DELETE`) succeeds in tab 1, broadcast
`{ type: 'mutation', method, url }` (repository `request-success` already fires
for uncacheable requests too, with per-request UUID keys). Receiving tabs
respond by refreshing their **in-use** cacheable entries — exactly what
`repository.refreshInUse()` does (consumers > 0, reads only, `force: true`).

**Default scope: refresh _all_ in-use queries of that client** in the other
tabs, with an optional narrowing filter:

- The tempting path-heuristic default (invalidate entries whose path prefixes
  the mutation path or vice versa: `PUT /players/123` → `/players`,
  `/players/123`, `/players/123/stats`) silently **misses** nested list routes
  like `/leagues/1/players` — and a sync feature that sometimes doesn't sync is
  worse than one that over-fetches. Refresh-all-in-use is bounded by what is
  actually on screen in the other tab, deduped by the repository, and always
  correct.
- Apps with chatty mutations narrow it via config:
  `refreshOnMutation: { filter: (mutation, entry) => boolean }` where
  `mutation` is `{ method, url }` and `entry` exposes `{ url, method }`. The
  path heuristic can ship later as an exported helper filter, not the default.

The mutating tab itself is **unchanged**: local post-mutation refresh remains
the app's job (as today — typically re-execute or args-driven). Auto-refreshing
locally would double-fetch in every app that already handles it. A future
public `client.invalidateQueries(filter?)` that refreshes locally _and_
broadcasts is a natural follow-up, noted in §6.

Note the pieces already in place: tab 3's player-A detail view updates via
§1.1 the moment any tab refetches it, and via §1.3 it is one of the refreshed
in-use queries. Logout in one tab already tears down secure entries everywhere
(auth sync calls `repository.unbindAllSecure()`), so no new work there.

## 2. Public API / config

Extend `CreateQueryClientConfigOptions` (mirrors the auth provider's option):

```ts
export const client = createQueryClient({
  name: 'api',
  baseUrl: '…',
  multiTabSync: true, // or an options object:
  // multiTabSync: {
  //   channelName?: string;          // default `et-query-sync-${name}`
  //   syncResponses?: boolean;       // default true  (§1.1)
  //   dedupePolling?: boolean;       // default true, inert without syncResponses (§1.2)
  //   refreshOnMutation?: boolean | { filter: (mutation, entry) => boolean }; // default true (§1.3)
  // },
});
```

- **Opt-in (default off).** Recommendation, to be confirmed: unlike the auth
  sync (pure win, on by default), this changes observable network behavior —
  background tabs stop polling, mutations fan out refreshes, response bodies
  must be structured-cloneable. Apps should turn it on deliberately; flipping
  the default later is easy, the reverse is a breaking change.
- Per-creator opt-out for §1.1's payload concern:
  `createGetQuery(client)<Args>(route, { multiTabSync: false })` (on
  `CreateQueryCreatorOptions`) — entry neither broadcasts nor applies shared
  responses, and therefore always polls itself.
- One channel per client (name-scoped), so multiple clients never cross-talk.
  Everything is SSR-safe no-op (`isPlatformBrowser`, same guard style as the
  repository's `retentionEnabled`).

## 3. Implementation plan

### Phase 1 — sync primitives (`libs/query/src/lib/http/sync/`)

Small, dependency-injected wrappers so everything is testable without real
browser APIs (specs are vitest; the auth specs already mock
`BroadcastChannel` on `globalThis` — we go one step further with interfaces):

- `SyncTransport`: `postMessage(msg)` / `onMessage(cb)` / `destroy()` over a
  `BroadcastChannel`, plus the versioned message envelope
  (`{ v: PROTOCOL_VERSION, …payload }`) and type guards. No-op impl when
  `BroadcastChannel` is undefined.
- `KeyLockManager`: `hold(key, onAcquired, onReleased?, signal)` over
  `navigator.locks`, abortable. Fallback impl (no Web Locks / server): every
  caller is immediately "holder" — degrades to current behavior.
- In-memory fakes for both (a shared fake bus + fake lock table lets one spec
  wire two repositories together as "two tabs").

### Phase 2 — repository & request hooks

- `http-request.ts`: `applyExternalResponse` (internal; not on the public
  `HttpRequest` surface — keep it on a `subtle` sub-object per the styleguide's
  internal-API convention).
- `query-repository.ts`: `applyExternalResponse(key, body, expiresAt)` with the
  §1.1 rules; expose enough entry metadata for the mutation filter (`url`,
  `method` — already on the request).

### Phase 3 — client sync engine

- `createQuerySyncEngine(config, repository)` wired inside `createQueryClient`
  when `multiTabSync` is enabled (browser only): subscribes to repository
  `events$`, broadcasts response/mutation messages, applies incoming ones
  (`refreshOnMutation` → `repository.refreshInUse()` or filtered variant).
  Also owns the `KeyLockManager` instance and exposes it (plus per-creator
  enablement checks) to features via `QueryClient` — an internal
  `client.subtle.sync` handle, since `withPolling` reaches the client through
  `deps.client` (`query-dependencies.ts`).
- Filtered refresh needs a small addition to `refreshInUse` (accept an optional
  predicate) rather than a parallel loop.

### Phase 4 — polling dedup

- `withPolling` (`query-features.ts`): consult `deps.client.subtle.sync`; track
  `execute.currentRepositoryKey()` in the existing args `nestedEffect`, hold
  the key lock, skip ticks while not holding. Visibility handoff (§1.2).
  Careful with the existing lifecycle: interval reset on args change and
  `destroyRef.onDestroy` cleanup must also move/abort the lock request.

### Phase 5 — devtools (optional, cheap)

The query devtools (`libs/query/src/lib/devtools/`) already render cache
entries off `repository.subtle`. Add per-entry badges: "synced from another
tab" (last-applied timestamp) and "polling: holder/standby". Helps a lot when
someone asks "why isn't this tab polling?".

### Phase 6 — docs + changeset

- New page `apps/docs/query/multi-tab.md` (config, the three capabilities,
  safety semantics, caveats: side-effect features, throttling handoff, version
  skew). Cross-link from `caching.md` (dedup is per _tab_ today — now
  optionally per browser), `features.md` (`withPolling`), and `auth.md`'s
  multi-tab section. Register in the VitePress sidebar.
- A live demo story would need two frames sharing origin — Storybook iframes on
  the same origin actually make this feasible (two `<iframe>`s of the same
  story); scope it as nice-to-have.
- Changeset: `minor` on `@ethlete/query`.

## 4. Testing strategy

- **Two-tab simulation specs**: two repositories + sync engines over the shared
  fake transport/lock table. Cover: response applied to same-key entry (and
  linkedSignal propagation to a bound query), loading-entry skip, cold-key
  ignore, unused-entry update, mutation → filtered/full refresh in the other
  "tab" only, no broadcast loops (apply must not re-emit), protocol-version
  mismatch ignored.
- **Polling**: holder polls / standby skips, lock handoff on release (holder
  destroyed → standby starts within one interval), args change re-keys the
  lock, visibility release/re-request, fallback (no locks) → both poll.
- **SSR**: engine is a no-op, no timers/channels created (mirror the
  `retentionEnabled` server guard tests).
- Auth internal specs stay untouched — no shared code is moved in v1 (migrating
  auth's leader election to Web Locks is possible later, deliberately out of
  scope).

## 5. Open questions (recommendations inline)

1. **Default off?** Recommended (§2) — confirm before Phase 3.
2. **Mutation refresh default = all-in-use?** Recommended (§1.3); the path
   heuristic ships only as an opt-in helper filter, if at all.
3. **Side-effect features staying silent on shared responses** (§1.1) —
   acceptable for v1? Recommended yes; a synthetic event type could be added
   later without breaking anything.
4. **Per-creator flag name**: `multiTabSync: false` on
   `CreateQueryCreatorOptions` vs tucking it under `subtle`. Leaning top-level
   (it is a legitimate consumer decision, not an escape hatch).

## 6. Explicit non-goals (v1)

- Cross-tab dedup of _initial_ parallel fetches (lock around first execution) —
  adds latency coupling between tabs for a rare, cheap overlap; freshness
  sharing already catches the common remount case.
- Seeding cold cache entries from broadcasts — i.e. creating a cache entry in a
  tab that never held the key, on speculation. Unbounded memory for a small
  prefetch-shaped win; if ever wanted, design it as a deliberate prefetching
  feature, not a sync side effect. Only entries that already exist (in use or
  retained) get updated.
- Persisting responses (localStorage/IndexedDB offline cache) — **done
  (2026-07-31)**, see `plans/query-offline-persistence.md`.
- Legacy `V2QueryClient` support — confirmed not needed.
- Migrating auth leader election to Web Locks — **done (2026-08-01)**.
  `libs/query/src/lib/auth/internal/leader-election.ts` holds one
  `createQueryKeyLockManager('ethlete-auth')` lock instead of the
  heartbeat/localStorage election; the instance count is derived from
  `navigator.locks.query()`, recounted off a presence ping rather than a timer.
- `client.invalidateQueries()` public API (local + broadcast unified) — **done
  (2026-08-01)**. `libs/query/src/lib/http/query-invalidation.ts` plus an
  `invalidate` sync message; narrowed by `url` (boundary-aware) and a local-only
  `filter`, with `otherTabs` to opt out of the broadcast.
