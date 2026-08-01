# Multi-tab sync

A user with your app open in three tabs runs three query clients, each with its own
[cache](/query/caching) and its own timers. Left alone, all three poll the same endpoint, and a
mutation in one leaves the other two showing data that is quietly wrong.

So the clients in a browser talk to each other over a `BroadcastChannel`, and elect one tab per cache
key with the [Web Locks API](https://developer.mozilla.org/docs/Web/API/Web_Locks_API). **This is on
by default** — a user with several tabs open is the normal case, and the three behaviors below are what
they would expect to happen.

```ts
const API = createQueryClient({
  name: 'api',
  baseUrl: 'https://api.example.com/v1',
  // multiTabSync: true is the default — pass an object to tune it, or false to opt out entirely.
});

export const injectApi = toInjectFn(API);
```

The one requirement is that response bodies survive a
[structured clone](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Structured_clone_algorithm),
which JSON always does. Everything is inert on the server, and degrades to per-tab behavior in a
browser without the two APIs.

## The three things it does

### Response sharing

When a cacheable request settles successfully in one tab, its body and freshness window are
broadcast. Any tab holding a cache entry for the **same key** adopts it — the key is a hash of route
plus args, so two tabs running the same query derive the same one.

That is the foundation the rest is built on, and on its own it means:

- a query on screen in three tabs shows the same data in all three, updated by whichever tab fetched
  last,
- the shared freshness window makes the entry _fresh_ everywhere, so a remount that passes
  `allowCache` in another tab serves it without a request.

A response is only applied to an entry that already exists. Cold keys are never seeded — creating
cache entries in a tab that never asked for them would be unbounded memory for data nobody is looking
at. An entry with a request of its own in flight is skipped too; that request is at least as fresh
and about to overwrite it anyway.

Entries sitting out their [`keepUnusedFor` window](/query/caching#keeping-unused-entries-around)
without consumers **are** updated. It costs nothing, and it means a back navigation renders data that
is current rather than merely recent.

Adopting a shared response is silent, which also means the receiving tab does not write it to the
[persisted store](/query/persistence): the tab that made the request is the only one that does.

### Polling dedup

[`withPolling`](/query/features#withpolling) in several tabs polls from **one** of them; the others
keep their interval running but skip each tick and get the data through response sharing. Election is
per cache key rather than per tab, because the tab that happens to be "leader" may not even have the
query mounted:

```ts
// Open in four tabs: one request every 10s in total, not four.
const scoreboard = getScoreboard(
  withArgs(() => ({ pathParams: { matchId: matchId() } })),
  withPolling({ interval: 10_000 }),
);
```

Web Locks handle the parts that make hand-rolled leader election unpleasant: requests queue FIFO, and
a holder that closes, crashes or navigates away releases its lock automatically — the next tab takes
over within one interval, with no heartbeats and no split-brain window.

Two more behaviors worth knowing:

- **Hidden tabs hand over.** A backgrounded tab has its timers throttled to roughly once a minute,
  which would starve the visible tabs waiting behind it. On becoming hidden, a holder releases its
  lock and immediately asks again — FIFO puts it behind anyone already queued, and hands it straight
  back if nobody else wants the key.
- **The holder's interval wins.** If two tabs poll the same key at different intervals, the effective
  rate is the holder's. There is no negotiation protocol.

Dedup is inert unless response sharing is on for that entry. That is enforced in code, not just
documented: suppressing a poll is only safe while the suppressed tab still receives the data.

### Mutation-driven refresh

A successful `POST` / `PUT` / `PATCH` / `DELETE` in one tab refreshes the queries the **other** tabs
currently have on screen — the same set [`refreshQueriesInUse()`](/query/caching#refreshing-everything-in-use)
covers: cacheable entries with at least one consumer.

The default is to refresh all of them. The tempting alternative — invalidating only entries whose
path relates to the mutation's — silently misses nested list routes (`PUT /players/1` also
invalidates `/leagues/1/players`), and a sync feature that sometimes doesn't sync is worse than one
that occasionally over-fetches. The scope is bounded by what is actually on screen in the other tab
and deduplicated by the repository.

Apps with chatty mutations can narrow it:

```ts
multiTabSync: {
  refreshOnMutation: {
    filter: (mutation, query) => new URL(query.url).pathname.startsWith('/players'),
  },
},
```

The mutating tab itself is untouched. Refreshing locally after a mutation stays the app's job, as it
is without sync — auto-refreshing there would double-fetch in every app that already handles it.

## Invalidating on purpose

The three above happen on their own. When the app knows what went stale — it just mutated something,
or a push message said someone else did — [`invalidateQueries()`](/query/caching#invalidating-after-a-change)
says so explicitly, and the message reaches every tab:

```ts
await createPlayer.execute({ body });

injectApi().invalidateQueries({ url: '/players' });
```

Unlike the mutation heuristic this also refreshes the tab it was called in — it is the app talking,
not the client guessing from a request it happened to see — and `refreshOnMutation: false` does not
opt out of it. `otherTabs: false` keeps a single invalidation local.

What travels is the resolved URL, never the `filter` function: the receiving tabs narrow by URL alone
and invalidate a superset of what the calling tab did.

## Configuration

```ts
multiTabSync: {
  channelName: 'et-query-sync-api',
  syncResponses: true,
  dedupePolling: true,
  refreshOnMutation: true,
}
```

| Option              | Default                 | Description                                                                                                 |
| ------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| `channelName`       | `et-query-sync-${name}` | The `BroadcastChannel` name, which also scopes the poll locks. One per client, so clients never cross-talk. |
| `syncResponses`     | `true`                  | Share successful reads between tabs.                                                                        |
| `dedupePolling`     | `true`                  | Poll a given cache key in one tab only. Inert without `syncResponses`.                                      |
| `refreshOnMutation` | `true`                  | Refresh other tabs' in-use queries after a mutation. Pass `{ filter }` to narrow it.                        |

Those defaults are what you get without saying anything. `multiTabSync: false` turns all of it off, and
each part can be switched off on its own — `dedupePolling: false` keeps shared responses but lets every
tab poll, for instance.

### Opting a single query out

```ts
const getQuery = createGetQuery(client);

export const getHugeExport = getQuery<ExportQueryArgs>('/exports/full', { multiTabSync: false });
```

The entry then neither broadcasts nor accepts shared responses, and — since dedup would no longer be
safe — every tab polls it itself again. The reason to reach for this is payload cost: every shared
response is structured-cloned once per receiving tab, so a very large body on a short polling interval
is better left alone.

## Safety and limits

- **Same user, same session.** Tabs share an origin, and the [auth provider](/query/auth#multi-tab-sync)
  already synchronizes tokens and logout across them, so a shared response never crosses a session
  boundary. A logout tears down secure entries in every tab, leaving nothing for a late message to
  land on.
- **Side-effect features stay quiet for shared responses.** `withSuccessHandling`, `withLogging` and
  the query's `events$` fire for requests _this_ tab made over HTTP. A response adopted from another
  tab updates the signals — `response`, `executionState`, everything derived — but emits no event.
  That is what keeps the two tabs from bouncing the same response back and forth forever. If a side
  effect must run on data from anywhere, drive it from the response signal rather than the event.
- **Bodies must be structured-cloneable.** JSON is fine. `blob` / `arraybuffer` response types clone
  too but are heavy. A body the algorithm cannot handle is logged in dev mode and simply not shared.
- **Version skew is handled, shape skew is not.** Messages carry a protocol version, and a tab ignores
  versions it does not know — the realistic case being a user with the previous deploy still open next
  to a freshly loaded one. Two deploys whose _response shapes_ differ under the same protocol version
  is accepted risk, exactly as it is for the auth token sync.
- **Server-side rendering.** Always a no-op: no channel is opened and no lock is requested.
- **Browser support.** `BroadcastChannel` and Web Locks are available in every browser the SDK
  targets. Without them the client degrades to current behavior — every tab fetches and polls for
  itself — rather than failing.

## Debugging it

The [query devtools](/components/query-devtools) **Cache** tab has a _Sync_ column per entry showing
`polling` or `standby` for the poll election, and how long ago the entry last took a response from
another tab. That is usually the fastest answer to "why isn't this tab polling?".

## Testing it

`@ethlete/query/testing` ships in-memory fakes for both browser APIs, because neither jsdom nor
happy-dom can stand in: jsdom's `BroadcastChannel` never delivers to other instances, and it has no
`navigator.locks` at all.

```ts
import { flushMultiTabSync, installFakeBroadcastChannel, installFakeWebLocks } from '@ethlete/query/testing';

const bus = installFakeBroadcastChannel();
const locks = installFakeWebLocks();

// Two clients sharing one channel name behave exactly as two tabs of one app.
const tabA = createQueryClient({ name: 'a', baseUrl, multiTabSync: { channelName: 'shared' } });
const tabB = createQueryClient({ name: 'b', baseUrl, multiTabSync: { channelName: 'shared' } });

// …drive queries in both, then let messages and lock grants land:
await flushMultiTabSync();

bus.restore();
locks.restore();
```

Both fakes are process-wide while installed, deliver on a microtask (never synchronously), and never
deliver a message back to the channel that posted it — so both sides run the real production code
path. `bus.posted` lists everything broadcast; `locks.heldNames()` and `locks.pendingNames()` show the
election.
