# Persisting query responses (offline cache) for @ethlete/query

**Status (2026-07-31): done.** All six phases shipped; docs live at `apps/docs/query/persistence.md`.
Size: M–L. Follow-up 1 of 3 from `plans/query-multi-tab-sync.md` §6.

**Deviation from the plan:** §2 recommended shipping opt-in; the default was decided **on** before
implementation (same call as multi-tab sync), making the changeset `major`. `persistence: false` is the
opt-out, per client or per query.

Implementation notes worth keeping:

- The engine needs no seam in the repository's construction. It learns about cold entries from a new
  `entry-created` repository event, so — exactly like the sync engine — it is a pure `events$` consumer
  created _after_ the repository, and hydration, writing and the logout purge all arrive on one stream.
- `applyPersistedResponse` exists on both the request (`subtle`) and the repository, next to
  `applyExternalResponse`, and differs from it in one deliberate way: it does not clear `error`.
- Two IndexedDB object stores (`meta`, `bodies`) in one transaction: the startup index read then never
  deserializes a body, which is what makes a metadata-only in-memory index affordable.
- **Verified against real IndexedDB** in the devtools Storybook story (jsdom has none): session one wrote
  5 entries across both stores; on reload all five showed `from disk 0s ago` while still `refreshing…` at
  ~450ms, with the network response landing at ~750ms. Hydration fills the gap and never suppresses the
  request, end to end.
- A dropped connection is retried indefinitely by the default retry policy, so a genuinely offline query
  never reaches `failure` — it stays `loading` with the persisted data on screen. The `failure`-with-data
  case is a failed _server_ response (a 500), which is what the spec covers.

Today every response the query client holds lives in memory only: a reload starts from an empty
cache, and a reload without a network starts from nothing at all. This adds a **disk copy of
successful public reads**, per client and on by default, so that

1. a reload renders the last known data immediately instead of a loading state, and
2. a cold start without a network renders it too, with the failed revalidation reported as usual.

It deliberately does **not** turn the client into an offline-capable app framework — no mutation
outbox, no background sync, no request replay (§7).

Prior art to follow: the multi-tab sync engine (`src/lib/http/sync/`) is the same shape of feature —
a per-client engine that hangs off `repository.events$`, writes back through a narrow repository
method, is a no-op on the server, and is configured as `boolean | { …options }` with a per-creator
opt-out. The persistence engine mirrors it closely enough that the two read as siblings.

## 1. Design

### 1.1 What is persisted, and by whom

The write side is a subscription to `repository.events$`, exactly like the sync engine's `broadcast`:
on `request-success` with `isCached: true` (a read under a deterministic cache key — includes GQL
over POST that opted into the cache), the engine queues `{ key, body, expiresAt, persistedAt, url,
method, isSecure }` for the store.

Consequences that fall out of using that event, all of them wanted:

- **Mutations are never persisted** — `isCached` is `false` for them, the same discriminator the
  sync engine uses to tell a shareable read from a mutation.
- **Responses adopted from another tab are never persisted.** `subtle.applyExternalResponse` is
  deliberately silent (no `events$` emit), so the tab that actually made the request is the only one
  that writes. Two tabs sharing one store therefore do not double-write, and no lock is needed —
  writes are last-write-wins per key, which for the same key is the same body.
- **Nothing is persisted before it exists.** No speculative seeding, unchanged from multi-tab §6.

Writes are **coalesced**: a key polled every second must not mean a store transaction every second.
Pending entries collect in a `Map<QueryKey, PersistedQueryEntry>` (last body wins) flushed on a timer
(`writeDelay`, default 1000ms), plus an immediate flush on `visibilitychange → hidden` and
`pagehide`, so a reload right after a fetch still finds the data.

### 1.2 What is read, and when — hydration is always async and always revalidates

Two rules define the whole read side:

> A cold cache entry may be filled from disk as long as it has no response yet.
> A persisted body never suppresses the request that entry makes.

The repository gains a new event, `{ type: 'entry-created', key, isCached, isPersistEnabled }`, emitted
from `request()`'s cold branch (`isSecure` is not on it — the secure decision is already folded into
`isPersistEnabled`). The engine reacts by reading that key
from the store and, when a body comes back, calling `repository.applyPersistedResponse({ key, body,
expiresAt })`, which fills the entry **only if `request.response()` is still `null`**. That single
condition covers every race for free: the network won (fast connection), another tab already fed the
entry, or the query was destroyed meanwhile — all of them make the hydration a no-op.

Why async-and-never-suppressing, rather than a synchronous hit that could skip the request:

- A synchronous hit needs every persisted body in memory before the first query mounts, which means
  either an eager bulk load (duplicating in memory what the repository is about to hold, bounded only
  by the entry cap) or blocking the first execute on a disk read — adding latency to every cold mount
  for a maybe-hit, and inverting the property that the network path is never slower than today.
- The "one tick late" cost is not observable in practice: the hydration lands in the same frame or
  the next, while the entry is in `loading` with no response — i.e. exactly the state an app already
  renders as a skeleton. What the user sees is data appearing, which is the point.
- It also answers the `expiresAt`-is-absolute problem (multi-tab §6) without inventing clock
  semantics: **the persisted `expiresAt` is stored and restored verbatim, but never cancels the
  revalidation**, because by the time it is read the request is already in flight. It only governs
  `allowCache` executes _later in the session_, where it means what it always meant. A body written
  on Monday and read on Tuesday is simply stale — shown, and revalidated. No clock-shift rewriting,
  no "was this fresh in a previous session" reasoning.

`request.subtle.applyPersistedResponse` is a sibling of `applyExternalResponse`: it writes
`response` + `expiresIn` and records `lastPersistedResponseAt`, silently (same anti-loop reason — an
emit here would re-enter `request-success` and rebroadcast a disk read to every tab). It differs in
one way: **it does not clear `error`.** A revalidation that failed must stay reported.

That last point has a visible consequence worth documenting rather than fixing here:
`QueryState.executionState` checks `error` before `response`, so an offline cold start ends up as
`{ type: 'failure' }` while `query.response()` returns the persisted body. This is not new — an
in-session refetch that fails over good data behaves identically today — so persistence does not get
to change the public union. It does make the gap more visible; a `failure` variant carrying
`cachedResponse` is a reasonable separate enhancement (§7).

The happy path, by contrast, needs nothing: hydrating while the request is in flight flips
`executionState` to `{ type: 'loading', hasCachedResponse: true, cachedResponse }` through the
existing `linkedSignal` chain, and every `computed`/template downstream updates.

### 1.3 The store, the index, and eviction

The engine keeps an **in-memory index** (`Map<QueryKey, { persistedAt, expiresAt, isSecure }>`) that
mirrors the store's metadata — no bodies. It is loaded once at startup and maintained on every write
and removal. It exists so that adapters stay dumb (five primitive methods) while every policy
decision — staleness, the entry cap, the logout purge — is made in the engine and unit-testable
without a real store.

Startup sequence (browser only, once per client):

1. `adapter.loadIndex()`.
2. `version` mismatch (see §2) → `adapter.clear()`, empty index. This is the escape hatch for a
   deploy whose response shapes changed: bump the number, every old body is dropped rather than
   hydrated into code that cannot read it. Same reasoning as `QUERY_SYNC_PROTOCOL_VERSION`, but
   app-owned, because the shapes are the app's.
3. Entries older than `maxAge` → `adapter.remove(keys)`, dropped from the index.
4. Resolve `whenReady`. Cold mounts that happened before this point are queued by key and read now.

`maxAge` (default 24h) is the one thing that bounds how old data may be _shown_. It is deliberately
separate from both neighbours it will be confused with, and the docs must say so:

| window          | governs                                         | lives    |
| --------------- | ----------------------------------------------- | -------- |
| `expiresAt`     | server freshness — may a read skip the network? | per read |
| `keepUnusedFor` | how long an unused entry stays **in memory**    | memory   |
| `maxAge`        | how old a body may be to be hydrated **at all** | disk     |

Eviction: after each flush, if the index exceeds `maxEntries` (default 50, mirroring
`MAX_UNUSED_ENTRIES`), the oldest by `persistedAt` are removed until it fits. A quota error from the
adapter is caught, prunes the oldest half, and retries once; a second failure disables writes for the
session with one dev-mode warning. Nothing about a full disk may break the repository event
subscription the write side runs inside — same defensive stance as the transport's `DataCloneError`
swallow.

### 1.4 Authenticated responses

Persisting a logged-in user's data to disk is a different decision from persisting a public list, so
it is gated separately:

- **Default: secure entries are not persisted.** `isSecure` is already on the success event.
- **Per creator, `persistence: true` opts a secure query in** — read as "yes, this endpoint's
  responses may sit on this device". For a public query `true` is already the default, so the flag
  only ever adds something.
- **Logout purges them.** The engine subscribes to the existing `unbind-all-secure` event (emitted by
  `repository.unbindAllSecure()`, which the auth multi-tab sync already calls in every tab) and
  removes every key the index marks secure. The in-memory teardown and the disk teardown then happen
  together, which is the whole point of tracking `isSecure` in the index.
- **No encryption at rest.** The bearer token's `encryptToken` (`auth/utils/token-encryption.ts`) is
  XOR against a key sitting in `localStorage` — obfuscation, not protection, and reproducing it for
  response bodies would only add the appearance of safety. Anything with script access on the origin
  can read the store either way. The honest mitigations are the opt-in gate, the logout purge, and a
  docs paragraph stating the trust level plainly.

### 1.5 Storage backend

`IndexedDB`, behind an adapter interface, with a no-op adapter when `indexedDB` is undefined:

```ts
export type QueryPersistenceAdapter = {
  loadIndex: () => Promise<PersistedQueryEntryMeta[]>;
  read: (key: QueryKey) => Promise<PersistedQueryBody | null>;
  write: (entries: PersistedQueryEntry[]) => Promise<void>;
  remove: (keys: QueryKey[]) => Promise<void>;
  clear: () => Promise<void>;
  isSupported: boolean;
};
```

IndexedDB rather than `localStorage`, despite `localStorage` being the only storage prior art in the
lib (`auth/features/bearer-auth-persistent-auth.ts:120`):

- It stores structured clones, so there is **no serialization pass at all** — and the bodies are
  already required to survive a structured clone by multi-tab sync, so persistence adds no new
  constraint on what a response may contain.
- Response bodies are orders of magnitude larger than the token that prior art stores. A synchronous
  `JSON.stringify` + write on the main thread on every settle is a jank source, and the ~5MB shared
  `localStorage` quota is easy to fill with a handful of list responses.
- Two object stores in one database (`bodies`: key → body, `meta`: key → metadata, written in one
  transaction) give §1.3's cheap index read without deserializing bodies.

The adapter seam is not speculative generality: jsdom has no IndexedDB, so specs need an in-memory
adapter regardless (§5), and the same seam lets an app supply `localStorage`, OPFS or a Capacitor
store without the library shipping a driver for each.

## 2. Public API / config

```ts
export const [provideMyClient, injectMyClient] = createQueryClient({
  name: 'api',
  baseUrl: '…',
  persistence: false, // on by default; pass an options object to configure it:
  // persistence: {
  //   storageName?: string;   // default `et-query-persistence-${name}`
  //   version?: number;       // default 1 — bump to drop every persisted body (§1.3)
  //   maxAge?: number;        // default 86_400_000 (24h)
  //   maxEntries?: number;    // default 50
  //   writeDelay?: number;    // default 1000
  //   adapter?: QueryPersistenceAdapter | (() => QueryPersistenceAdapter);
  //   filter?: (entry: { key; url; method; isSecure }) => boolean;
  // },
});
```

- **On by default** (decided 2026-07-31, against the plan's original recommendation of opt-in —
  same call as `multiTabSync`): a reload rendering the last known data is what a user expects, and an
  app that does not want responses on disk says `persistence: false`. ⇒ **`major`** changeset, since
  an upgrade starts writing to IndexedDB on its own. Two consequences the docs must lead with: the
  default only ever covers **public** reads (secure ones stay opt-in, §1.4), and `maxAge` /
  `maxEntries` are what bound how much of the user's disk this uses.
- **Per creator: `persistence?: boolean`** on `BaseQueryCreatorOptions`, next to `multiTabSync` and
  `keepUnusedFor`. `false` keeps a query memory-only (huge payloads, data that must not be shown
  stale, anything the app considers sensitive); `true` additionally opts a **secure** query in
  (§1.4).
- **`client.clearPersistedQueries(): Promise<void>`** — public. Needed for a user switch, a
  "clear cache" affordance, and debugging.
- **`client.whenPersistenceReady: Promise<void>`** — resolves once the index is loaded (immediately
  when persistence is off or on the server). Public because gating something on it is a legitimate
  app concern; it does **not** mean "bodies are hydrated", which is per-key and lazy by design.
- **`client.subtle.persistence: QueryPersistenceEngine | null`** — devtools, mirroring
  `subtle.sync`.
- Everything is inert on the server (`isPlatformBrowser`, the guard style `query-client.ts` already
  uses for retention and sync) and in a browser without IndexedDB.

## 3. Implementation plan

New directory `libs/query/src/lib/http/persistence/`, exported from `src/lib/http/index.ts` the way
`sync/` is.

### Phase 1 — storage seam

- `persisted-query-entry.ts`: `PersistedQueryEntry` / `…Meta` / `…Body`, and the store schema
  version constant (library-owned, distinct from the app-owned `version` config).
- `query-persistence-adapter.ts`: the interface plus the no-op adapter.
- `query-persistence-indexed-db.ts`: `createIndexedDbQueryPersistenceAdapter({ storageName })` —
  two object stores, one transaction per write, promise-wrapped requests, no dependencies.
- `libs/query/testing/persistence-test-utils.ts`: `createInMemoryQueryPersistenceAdapter()` with
  controllable resolution (deferred reads, injectable rejections for the quota path), exported from
  `testing/index.ts`.

### Phase 2 — the engine

`query-persistence-engine.ts`: `createQueryPersistenceEngine({ config, repository, adapter })`,
constructed after the repository like the sync engine, and holding everything from §1.1–1.4 — the
index, the startup load, the pending-key queue, the write queue and its flush/eviction, the secure
purge, `clear()`, `whenReady`, and a `destroy()` that flushes once and detaches.

Also `query-persistence-config.ts` for `QueryPersistenceConfig` and its defaults, mirroring
`query-sync-config.ts`.

### Phase 3 — repository & request hooks

- `http-request.ts`: `subtle.applyPersistedResponse({ body, expiresAt })` and
  `subtle.lastPersistedResponseAt`. Same silence as `applyExternalResponse`, but leaves `error`
  alone (§1.2).
- `query-repository.ts`:
  - `applyPersistedResponse({ key, body, expiresAt }) => boolean` — applies only when the entry
    exists, has persistence enabled, and `request.response() === null`.
  - the `entry-created` event, emitted from the cold branch of `request()` (after `bind`, carrying
    `isCached` / `isSecure` / `isPersistEnabled`).
  - `isPersistEnabled` on `request-success`, resolved from `creatorOptions.persistence` exactly as
    `isMultiTabSyncEnabled` is.
  - Adding an event variant is safe: every existing subscriber narrows on `type` first
    (`secure-query-execute-factory.ts:54`, `bearer-auth-query-builders.ts:268`,
    `sync/query-sync-engine.ts:89`).

### Phase 4 — client wiring

`query-client.ts`: resolve the config, create the adapter (config-supplied or IndexedDB, browser
only), create the engine, `inject(DestroyRef).onDestroy(engine.destroy)`, expose
`clearPersistedQueries` / `whenPersistenceReady` / `subtle.persistence`. Register the
`visibilitychange` / `pagehide` flush here, since it is the client that owns the document-level
listener lifetime.

### Phase 5 — devtools (optional, cheap)

`libs/components/src/lib/query-devtools/query-devtools.component.*` already renders the cache view
off `repository.subtle` and shows the multi-tab badges. Add a "from disk" badge (off
`request.subtle.lastPersistedResponseAt`, the way the external-response badge works) and a "clear
persisted cache" action. Answers "is this data from the server or from last week?" at a glance.

### Phase 6 — docs + changeset

- New page `apps/docs/query/persistence.md`: the two rules from §1.2, the three-window table from
  §1.3, the config, the authenticated-data section verbatim in spirit (opt-in, purge, no
  encryption), the `executionState`-reports-failure-offline caveat, and the custom adapter contract.
  Register it in `apps/docs/.vitepress/config.mts` and `apps/docs/query/index.md`.
- Cross-link from `caching.md` (which owns `keepUnusedFor` and freshness — the table belongs there
  too, at least as a pointer), and from `multi-tab.md` (structured-clone precondition is shared,
  and only the fetching tab writes).
- Changeset: **`major`** on `@ethlete/query` — persistence is on by default, so an upgrade changes
  behavior without anyone asking for it. The note must say what starts happening (public reads land in
  IndexedDB), how to stop it (`persistence: false`), and that secure reads are unaffected.

## 4. Order of work

Phases 1–2 are independently testable against the fake adapter with no repository involvement, so
they come first even though nothing observable happens until Phase 3. Phase 3 is the only phase that
touches existing files, and each of its four pieces is separately verifiable. Phase 4 makes it real.

## 5. Testing strategy

All against `createInMemoryQueryPersistenceAdapter()` — jsdom has no IndexedDB, and no
`fake-indexeddb` dependency is worth adding (a new dependency also means `yarn install` + lockfile +
the `@nx/dependency-checks` lint pass).

- **Write side**: a settled read is queued and flushed once per `writeDelay` with the last body;
  mutations, uncacheable reads, `persistence: false` creators, and `filter`-rejected entries are
  never written; a response adopted from another tab is not written (two clients, one fake adapter);
  flush on `visibilitychange → hidden`.
- **Read side**: a cold mount hydrates the entry while it is loading and `executionState` becomes
  `loading` + `hasCachedResponse`; the arriving network response overwrites it; a hydration that
  lands after the response is a no-op; a hydration after a failed request keeps `error` set and
  populates `response()`; a mount before `whenReady` is queued and hydrated after the index loads.
- **Policy**: `maxAge`-expired entries are neither hydrated nor kept; `version` mismatch clears the
  store; `maxEntries` evicts oldest-first; a rejecting adapter (quota) prunes, retries once, then
  goes quiet without breaking subsequent successful writes.
- **Secure**: not persisted by default; persisted with creator opt-in; every secure key removed on
  `unbindAllSecure()` while public keys survive.
- **SSR**: no adapter, no listeners, no timer; `whenPersistenceReady` resolves; `request()` emits
  `entry-created` but nothing reacts.
- **Real IndexedDB** cannot be covered by vitest here. Verify the adapter by hand once in a browser
  (Application → IndexedDB: two stores, one record per key, purge on logout, `clear()` empties it),
  and note in the plan file what was checked.

## 6. Open questions

**Decided 2026-07-31, before implementation:**

1. ~~Opt-in, default off?~~ → **on by default**, `persistence: false` to opt out, `major` changeset
   (§2).
2. ~~Secure bodies?~~ → **opt-in per creator (`persistence: true`) + purge on logout, no
   encryption** (§1.4).
3. ~~Hydration semantics?~~ → **always async, always revalidates**; a persisted body never suppresses
   a request (§1.2).

**Still open (recommendations inline):**

4. **`maxAge` default 24h and `maxEntries` default 50** — both are guesses that only feel wrong in
   production. Erring small is the safer direction.
5. **Naming**: `persistence` at both levels (client takes `boolean | config`, creator takes
   `boolean`), matching how `multiTabSync` reads the same at both. Alternative was `persistQueries` /
   `persist`.
6. **Ship a `localStorage` adapter too?** Recommend no in v1 — the seam is public, and shipping a
   second driver invites the quota/jank problems §1.5 avoids.
7. **`whenPersistenceReady` public vs `subtle` only** — recommend public (§2); it is the only way an
   app can gate anything on the store, and telling apps to reach into `subtle` for that is worse.

## 7. Explicit non-goals (v1)

- **Offline mutations** — an outbox that queues `POST`/`PUT`/`DELETE` while offline and replays them
  on reconnect. Much larger (ordering, conflict handling, optimistic state, a retry policy the app
  must be able to see and cancel) and independent of this. If wanted, its own plan.
- **Persisting error or loading state.** Only successful bodies are stored; a cold start after a
  failure looks exactly like a cold start.
- **Suppressing the initial request when the persisted body is fresh** (§1.2). Would require gating
  every cold mount on a disk read.
- **Speculatively seeding cold entries from disk** — same objection as multi-tab §6; hydration only
  ever fills an entry a consumer just created.
- **Encryption at rest** (§1.4).
- **Service-worker / HTTP-cache integration**, and any interaction with Angular's `transferCache`
  (which already covers first paint under SSR, in memory, per request).
- **A `failure` execution state carrying `cachedResponse`** (§1.2) — a real gap, but a change to a
  public union that stands on its own; do not smuggle it in here.
- **Legacy `V2QueryClient`.**
