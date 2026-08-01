# Persisted responses (offline cache)

The [cache](/query/caching) lives in memory, so a reload starts from nothing — every query on the page
goes back to a loading state, and a reload without a network shows nothing at all.

So successful reads are also kept on disk, in IndexedDB, per client. **This is on by default.** A
returning user sees the data they left behind while it revalidates behind them; a user with no
connection sees it too.

```ts
const API = createQueryClient({
  name: 'api',
  baseUrl: 'https://api.example.com/v1',
  // persistence: true is the default — pass an object to tune it, or false to opt out entirely.
});

export const injectApi = toInjectFn(API);
```

Two rules define the whole feature:

> A cache entry may be filled from disk as long as it has nothing of its own yet.
> A persisted response never suppresses the request that entry makes.

## What happens on a cold start

A query mounts, its cache entry is created, and its request goes out — unchanged from a client without
persistence. Meanwhile the store is read, and the response from last time is written onto the entry if
it is still empty:

| t          | `response()`   | `executionState()`                    |
| ---------- | -------------- | ------------------------------------- |
| 0ms        | `null`         | `loading`, `hasCachedResponse: false` |
| ~a few ms  | last session's | `loading`, `hasCachedResponse: true`  |
| on arrival | the server's   | `success`                             |

Nothing about the request changes, which is the point: persistence can only ever make a cold start
show something _earlier_, never make it slower or serve data instead of fetching. The other side of
that coin is that persisted data is always one tick behind the mount — the entry is briefly empty, so
a skeleton may flash on a fast machine with a slow disk.

If the revalidation **fails**, the persisted response stays. `query.response()` holds it, and
`error()` holds the failure — both are true at once, and both matter. Note that a dropped connection
is [retried](/query/errors#retries) indefinitely by the default retry policy, so a genuinely offline
query does not reach a `failure` state at all: it stays `loading` with the persisted data on screen.

::: tip Deciding what to render
`executionState()` reports `failure` when a request failed, even though `response()` still has the
persisted body — the same as any refetch that fails over data you already had. If a screen should keep
rendering data through a failed revalidation, read `response()` and treat the error as a banner rather
than a state.
:::

## Three windows, three different jobs

The one thing that confuses people about this feature is which expiry does what:

| Window                                                          | Question it answers                           | Lives    |
| --------------------------------------------------------------- | --------------------------------------------- | -------- |
| [Freshness](/query/caching#freshness) (`cacheAdapter`)          | May a read skip the network entirely?         | Per read |
| [`keepUnusedFor`](/query/caching#keeping-unused-entries-around) | How long does an unused entry stay in memory? | Memory   |
| `maxAge`                                                        | How old may a response be to be shown at all? | Disk     |

`maxAge` (24 hours by default) is the only bound on how stale a first paint can be. It is deliberately
separate from server freshness: a persisted response is always revalidated, so the question is not "is
this still valid" but "is this still plausible enough to show for a moment".

A response's freshness window is persisted alongside it and restored verbatim — usually meaning it is
already in the past, which is correct. It matters for what happens _next_ in the session: a later
`execute({ allowCache: true })` on a hydrated entry behaves exactly as it would have in the session
that fetched it.

## Authenticated responses

A logged-in user's data is on the other side of the default:

- **Secure queries are not persisted** unless the query says so. Leaving authenticated data on a
  device is a decision per endpoint, not a blanket one.
- **A logout removes them.** The auth provider tears down secure entries in every tab, and the
  persisted copies go with them, at the same moment.

```ts
const getQuery = createGetQuery(client);

// A secure query that may sit on the device — worth it for the data a returning user expects to see
// immediately, like their own profile or a dashboard shell.
export const getMe = getQuery<GetMeArgs>('/me', { persistence: true });
```

::: warning What "on disk" means
The store is ordinary origin storage. Anything that can run script on your origin can read it, so
persisting an authenticated response is a decision about _device_ trust — a shared computer, a kiosk —
not about XSS, which reads the same data out of memory anyway. There is no encryption at rest, because
a key that ships with the app is obfuscation and reads as protection it cannot provide.

For a user switch on a shared device, call `client.clearPersistedQueries()` — a logout only removes
secure entries, and public ones may still be recognizable ("the last thing this account looked at").
:::

## Configuration

```ts
persistence: {
  storageName: 'et-query-persistence-api',
  version: 1,
  maxAge: 86_400_000,
  maxEntries: 50,
  writeDelay: 1000,
}
```

| Option        | Default                        | Description                                                                                   |
| ------------- | ------------------------------ | --------------------------------------------------------------------------------------------- |
| `storageName` | `et-query-persistence-${name}` | The IndexedDB database name. One per client, so two clients never overwrite each other.       |
| `version`     | `1`                            | The version of your response shapes. Entries written under a different one are dropped.       |
| `maxAge`      | `86400000` (24h)               | How old a response may be and still be shown. Older ones are dropped at startup.              |
| `maxEntries`  | `50`                           | How many responses are kept. The least recently written go first.                             |
| `writeDelay`  | `1000`                         | How long writes are collected before one batched flush. Always flushed when the tab hides.    |
| `adapter`     | IndexedDB                      | Where to store responses. See [custom storage](#custom-storage).                              |
| `filter`      | —                              | `(candidate) => boolean` over `{ key, url, method, isSecure }`; `false` keeps a response out. |

### Bump `version` when a response shape changes

This is the one option that needs a habit rather than a value. A returning user's disk copy was written
by the deploy they had _last time_:

```ts
// In the same commit that renames a field, changes an envelope, or splits an endpoint:
persistence: {
  version: 2,
}
```

Every entry is written under the version it was created with, and anything else is dropped rather than
handed to code that can no longer read it. Rolling back works for the same reason: the old build
ignores what the new one wrote.

### Opting a single query out

```ts
export const getHugeExport = getQuery<ExportArgs>('/exports/full', { persistence: false });
```

Three reasons to reach for this: a payload too large to be worth the disk, data that must never be
shown stale even for the moment a revalidation takes, and anything you would rather not store at all.

### Clearing the store

```ts
await client.clearPersistedQueries();
```

### Gating the first paint

Nothing needs to wait for the store — a query created before it is read is hydrated as soon as it is.
An app that would rather delay its first paint than show a loading state it knows it has data for can
await it:

```ts
provideAppInitializer(() => injectApi().whenPersistenceReady);
```

That resolves once the store's index is loaded (immediately when persistence is off, or on the server).

## Custom storage

IndexedDB is the default because it stores
[structured clones](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Structured_clone_algorithm) —
no serialization pass, and the same constraint on bodies that [multi-tab sync](/query/multi-tab)
already has — and because response bodies are far too large for `localStorage`'s few megabytes.

Supply an adapter to store them somewhere else: `localStorage`, the origin private file system, a
native store behind a Capacitor plugin.

```ts
persistence: {
  adapter: {
    loadIndex: () => Promise<PersistedQueryEntryMeta[]>, // metadata only, once at startup
    read: (key) => Promise<{ body: unknown } | null>, // one body, on a cold mount
    write: (entries) => Promise<void>, // a coalesced batch
    remove: (keys) => Promise<void>,
    clear: () => Promise<void>,
    isSupported: true,
  },
}
```

Adapters are deliberately dumb: they store what they are handed. `maxAge`, `maxEntries`, the `version`
check and the logout purge are all decided before a call reaches one, so a custom adapter cannot get
any of that subtly wrong. Every method may reject — a failing read is treated as a miss, and a failing
write as a full disk.

## Safety and limits

- **Only successful reads.** Mutations are never persisted, and neither are errors or loading states.
  A cold start after a failure looks exactly like a cold start.
- **Only the tab that fetched writes.** A response adopted from another tab over
  [multi-tab sync](/query/multi-tab#response-sharing) is applied silently, so it produces no write —
  tabs sharing one store do not duplicate each other's work.
- **Side-effect features stay quiet for persisted responses.** As with a shared response,
  `withSuccessHandling`, `withLogging` and the query's `events$` fire for what _this_ request received
  over HTTP. Hydration updates the signals and emits nothing.
- **A full disk gives up quietly.** A write that fails frees the oldest half of the store and retries
  once; a second failure stops writing for the session with one dev-mode warning. Queries are
  unaffected either way.
- **Server-side rendering.** Always a no-op — no store is opened. Angular's `transferCache` already
  covers the SSR hand-off, in memory and per request.
- **Browsers without IndexedDB**, or with storage denied, degrade to in-memory caching rather than
  failing.

## Debugging it

The [query devtools](/components/query-devtools) **Cache** tab shows how many responses the client has
on disk, a _Disk_ column saying how long ago an entry took its data from there, and a _Clear disk_
button.

## Testing it

jsdom has no IndexedDB, so `@ethlete/query/testing` ships an in-memory store. It is a real adapter
rather than a mock, so a spec exercises the production write and read paths:

```ts
import { createFakeQueryPersistenceStore } from '@ethlete/query/testing';

const store = createFakeQueryPersistenceStore();

// A reload is two clients over one store: everything written survives, nothing else does.
const first = createQueryClient({ name: 'first', baseUrl, persistence: { adapter: store.adapter } });
// …drive a query, then:
await TestBed.inject(first[2]).subtle.persistence!.flush();

const second = createQueryClient({ name: 'second', baseUrl, persistence: { adapter: store.adapter } });
// …mount the same query; after a few microtasks it renders what the first session left behind.
```

`store.entries()` is what is on disk, `store.calls()` counts adapter calls, and `deferReads()` /
`flushReads()` hold a read pending so a spec can decide whether the disk or the network wins the race.
`failNextWrites()` and `failNextLoadIndex()` cover the quota and unreadable-store paths.
