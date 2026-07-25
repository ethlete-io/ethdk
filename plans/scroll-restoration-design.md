# Scroll restoration — design & findings

Companion to [`scroll-restoration.md`](./scroll-restoration.md). Research done
2026-07-25 against the actual sources (`libs/core`, `libs/query`,
`node_modules/@angular/router@22.0.7`). Records what was verified, the options
considered, and the decisions taken so the plan's "research/design fork" is
closed.

**Status: complete — both layers designed and implemented.**

---

## 1. Findings

### 1.1 What `setupScrollRestoration` does today (it is a misnomer)

`libs/core/src/lib/signals/recipes/scroll-restoration.ts` does **scroll-to-top on
navigation**, not restoration. It subscribes to `router.events`
(`NavigationEnd` / `NavigationSkipped`) and:

- **different route** → `scrollElement.scrollTop = 0`, unless the route opted out
  via `data: routerDisableScrollTop({ asReturnRoute?, onPathParamChange? })`;
- **same route** → scroll-to-top only if a query param in `queryParamTriggerList`
  changed, else optionally scroll to the fragment element.

Nothing saves a scroll offset, and nothing reads one back. The three
`ET_DISABLE_SCROLL_TOP*` route-data symbols exist **because** there was no real
restoration — `asReturnRoute` is a hand-rolled "don't destroy the offset when
coming back from a detail page" hack that only works because in a SPA the scroll
container keeps whatever offset it had.

Consequence for the design: real restoration **supersedes** `asReturnRoute`, and
the two mechanisms must not both run. They live in the same subscription, so this
is an integration, not a second module.

### 1.2 The browser is actively fighting us

`history.scrollRestoration` defaults to `'auto'` and is never set anywhere in the
repo (`grep`: no `scrollRestoration`, no `ViewportScroller`, no
`withInMemoryScrolling`, no `scrollPositionRestoration` — the Angular router's
own scroller is **not** installed in any consumer path we ship). So on back-nav
the browser restores the offset against the loading-state document, which is
exactly the bug in the plan's problem statement. Any real fix **must** set
`history.scrollRestoration = 'manual'`.

### 1.3 Angular already solved the "which history entry" problem — reuse its keying

`RouterScroller` (`node_modules/@angular/router/fesm2022/_router_module-chunk.mjs:890`)
is the reference implementation. Its scheme:

```
NavigationStart      → store[lastId] = current scroll position
                       restoredId = e.restoredState?.navigationId ?? 0
                       lastSource = e.navigationTrigger
NavigationEnd        → lastId = e.id ; schedule a Scroll event after setTimeout + rAF
consume Scroll event → if lastSource === 'popstate', scroll to store[restoredId]
```

Verified in `_router-chunk.mjs`:

- `HistoryStateManager.generateNgRouterState()` (line 4353) writes
  `{ navigationId, ... }` into `history.state` on **every** navigation — no
  `canceledNavigationResolution: 'computed'` needed (that only adds
  `ɵrouterPageId`).
- `navigateToSyncWithBrowser()` (line 4509) turns that back into
  `restoredState`, which surfaces publicly as
  `NavigationStart.restoredState?: { navigationId: number }`
  (`types/_router_module-chunk.d.ts:116`).

So `NavigationStart.restoredState.navigationId` is a **stable per-history-entry
key available today, with zero extra router config**. We do not need to write our
own id into `history.state`, and we do not need `withInMemoryScrolling`.

Two things `RouterScroller` gets right that we must copy:

- capture the outgoing offset at **`NavigationStart`**, not `NavigationEnd` — by
  `NavigationEnd` the router has already committed and activated, so the offset
  can be gone;
- `NavigationSkipped` with code `IgnoredSameUrlNavigation` resets `restoredId` to
  0 (it is not a history move).

And one thing it gets **wrong for us**: it restores after a single
`setTimeout` + `requestAnimationFrame`. That is precisely the frame where our
query-driven lists are still empty. This is the whole reason we can't just turn on
`withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`.

### 1.4 `withInMemoryScrolling` is not a viable base — for a second reason

`ViewportScroller` only ever scrolls the **window**. Apps in this SDK's ecosystem
commonly scroll a custom app-shell element, which is why our config already has
`scrollElement`. Angular's scroller cannot target it at all. So we own the whole
mechanism; we only borrow the keying scheme.

### 1.5 The query cache cannot hold stale data today — the plan's "shower thought" doesn't apply as written

This is the most important finding for layer 2, and it invalidates the framing in
`scroll-restoration.md` §2.

`createQueryRepository` (`libs/query/src/lib/http/query-repository.ts:165`) keys
entries by cache key, but lifetime is **consumer ref-counting**, not TTL:

```ts
// query-repository.ts:240
const unbind = (key, consumerDestroyRef) => {
  cacheEntry.consumers.delete(consumerDestroyRef);
  if (cacheEntry.consumers.size === 0) {
    cacheEntry.request.destroy(); // ← immediate
    cache.delete(key); // ← immediate
  }
};
```

`bind()` registers `consumerDestroyRef.onDestroy(() => unbind(...))`, so
**navigating away destroys the entry the moment the route component is
destroyed** — regardless of `cache-control`, regardless of TTL. The
header-derived `expiresIn` / `isStale()` pair (`http-request.ts:158-167`) only
decides whether a **living** entry re-executes; it has nothing to do with
survival across a navigation.

Therefore:

- "keep stale results past their TTL" is a no-op — there is no entry left to keep
  stale;
- the real minimal change is **retention after the last unbind** (a
  TanStack-style `gcTime` grace period). That is orthogonal to `cache-control`,
  so — importantly — **it works on private/authed routes too**, which kills the
  plan's caveat that the cache lever "does nothing there". The caveat was correct
  about TTL-based caching and wrong about the mechanism we'd actually build.

Two supporting facts that make retention cheap and safe:

- `execute()` (`http-request.ts:205`) resets `loading`, `error` and `expiresIn`
  but **never clears `response`**. So a re-bound entry keeps its old body while
  it refetches.
- `QueryState.rawResponse` is `linkedSignal(() => request()?.response() ?? null)`
  (`query-state.ts:85`) and `executionState` already models
  `{ type: 'loading', hasCachedResponse: true, cachedResponse }`
  (`query-state.ts:69`). So stale-while-revalidate rendering is **already
  supported end to end** — a retained entry would render full-height content on
  the first frame back, with no new query API surface.

### 1.6 Virtualization is a help, not a hazard

`createVirtualWindow` (`libs/components/src/lib/internals/virtual-window.ts`)
derives scroll height from `itemCount × itemHeight` with spacer paddings, using
`estimateItemHeight` until a real row is measured. So a virtualized table reaches
its (approximate) full scroll height as soon as `itemCount` is known — i.e. on
the frame the query resolves, before rows are measured. A height-driven restore
converges on it immediately; a "wait for measured heights" contract would
actually be _slower_ and more fragile. Nothing needs to change in the table.

### 1.7 There is no "settled" signal to hook, and we should not invent a mandatory one

`libs/components/src/lib/table/**` exposes no settle/ready output, and neither
does `scrollable`. Making one mandatory would mean touching every list component
and every consumer page before restoration works anywhere. See option B below —
we don't need it.

---

## 2. Options considered (layer 1)

### Option A — explicit "settled" contract (the plan's original sketch)

Consumers register a settle source (`table`, list, page) and the coordinator waits
for all of them.

- **+** Semantically precise; no polling.
- **−** Restoration works **only** on components that opted in. Everything else
  (plain `@for` lists, images, fonts, third-party embeds) stays broken.
- **−** Registration races: `@if`-gated children register _after_ `NavigationEnd`,
  so the coordinator can't know how many sources to expect. Needs a quiet-period
  heuristic anyway — i.e. it ends up with option B's timing machinery _plus_ a
  contract.
- **−** Cross-library API surface (core needs a registry, components needs to
  emit into it) for something the platform can observe directly.

**Rejected as the primary mechanism.**

### Option B — height-driven wait window (chosen)

After a popstate navigation with a saved offset, watch the scroll container's
`scrollHeight` on `requestAnimationFrame` until the saved offset becomes
**reachable** (`scrollHeight - clientHeight >= target`), then apply it once.

- **+** Zero consumer opt-in — works for every route, every data source, images,
  fonts, virtualization, `@defer`.
- **+** No dependency on `@ethlete/query` (keeps this in `core`, where the
  existing recipe and the router signals already live — resolves the plan's "who
  owns this" question).
- **+** Converges naturally with virtualization (§1.6).
- **−** Polls one layout read per frame during a short window. Measured cost is
  negligible: the loop only runs after a popstate, and only until reachable or
  the deadline (default 1000 ms ⇒ ≤60 reads worst case, and the browser is
  laying out those frames regardless).
- **−** Can't distinguish "content finished shorter than before" from "content
  still loading" — handled by the deadline + clamp.

### Option B+A — B as the mechanism, A as an _optional_ extension (chosen)

The only thing B genuinely can't do is know that a slow API call is still in
flight past the deadline. So keep A, but demoted to an optional per-page hold:

```ts
// inside a route component
holdScrollRestoration(() => query.isLoading());
```

While any registered hold is `true`, the deadline is suspended. This is ~30 lines,
composes with anything signal-shaped, and — crucially — is **not required** for
restoration to work.

### Rejected sub-options, recorded

- **Progressive re-apply** (set `scrollTop = target` every frame, letting the
  browser clamp it, so the page tracks the target as content grows). Rejected:
  the user watches the skeleton pinned to its own bottom edge and jittering
  upward. **Hold-then-apply-once** reads as a normal page load that snaps into
  place. (Kept as a documented escape hatch only if a consumer reports a
  regression; not implemented.)
- **`ResizeObserver` instead of rAF.** Doesn't work generically: `scrollHeight`
  changes don't resize the scroll container's own border box, so we'd have to
  observe children (unknowable) — or special-case `documentElement`. rAF is
  simpler, uniform, and bounded.
- **`sessionStorage` persistence** so offsets survive a full reload. Deferred:
  Angular's `navigationId` counter restarts at 1 on reload, so the keys collide
  with the previous session's. Doing this properly means writing our own id into
  `history.state` via `replaceState`. Real but separate; recorded in §5.
- **Writing our own `history.state` id.** Not needed — §1.3.

---

## 3. Decisions

| Question (from the plan)              | Decision                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does the nav-scoped store live? | `@ethlete/core`, inside the existing `setupScrollRestoration` recipe. In-memory `Map<number, number>` keyed by `restoredState.navigationId`.                                                                                                                                                        |
| Who owns "settled"?                   | Nobody, by default — the scroll container's own height is the signal. `holdScrollRestoration()` is an optional consumer-side override.                                                                                                                                                              |
| Router integration                    | Do **not** use `withInMemoryScrolling` (§1.4). Borrow `RouterScroller`'s keying, set `history.scrollRestoration = 'manual'` ourselves.                                                                                                                                                              |
| Interaction with virtualization       | None needed (§1.6).                                                                                                                                                                                                                                                                                 |
| Pagination vs back-nav                | Restore only when `NavigationStart.navigationTrigger === 'popstate'` **and** a position is stored for the target entry. A `page` param change via a link is imperative ⇒ still scroll-to-top. Back **through** pagination is a popstate ⇒ restores, and that now wins over `queryParamTriggerList`. |
| Breaking change?                      | No. Restoration is behind `restore: { enabled: true }`; every existing behavior is untouched when it's off.                                                                                                                                                                                         |

Additional decisions taken during implementation:

- **`scrollElement` accepts a getter** (`HTMLElement | (() => HTMLElement | null)`).
  Required for correctness, not convenience: with a per-route scroll container the
  element captured at app bootstrap is the wrong one, and restore has to read the
  _outgoing_ container at `NavigationStart` and the _incoming_ one after
  activation. Backwards compatible.
- **User interaction aborts the restore window.** `wheel`, `touchstart`,
  `keydown`, and any pointer-driven scroll during the window cancels it — user
  intent always beats a pending restore. Our own writes are flagged so they don't
  self-cancel.
- **Clamp on timeout** (default on): if the content never got tall enough, apply
  `min(target, maxScroll)` rather than nothing. Landing near the old spot beats
  landing at the top.
- **Saved offset beats the fragment** on a popstate: the user may have scrolled
  away from the anchor since. Fragment scrolling still applies when there is no
  saved offset.

---

## 4. Layer 1 shape (as built)

```ts
setupScrollRestoration({
  scrollElement: () => document.querySelector('.app-shell'),
  queryParamTriggerList: ['page'],
  restore: {
    enabled: true,
    timeout: 1000, // give up waiting for the content to reach the offset
    clampOnTimeout: true,
  },
});
```

```ts
// optional, per route component — suspends the timeout while it reads true
holdScrollRestoration(() => query.isLoading());
```

Flow:

```
NavigationStart
  ├─ store[lastNavigationId] = scrollElement.scrollTop      (always)
  ├─ restoredId = e.restoredState?.navigationId ?? 0
  └─ isPopstate = e.navigationTrigger === 'popstate'

NavigationEnd / NavigationSkipped
  ├─ lastNavigationId = e.id
  ├─ isPopstate && store.has(restoredId)
  │    └─ begin restore window (cancels scroll-to-top for this navigation)
  └─ else → existing scroll-to-top / query-param / fragment logic, unchanged

restore window (rAF loop; aborted by user interaction or a new navigation)
  ├─ reachable(target)          → apply once, done
  ├─ any hold() is true         → keep waiting, deadline suspended
  └─ deadline passed            → clampOnTimeout ? apply clamped : give up
```

---

## 5. Layer 2 — `keepUnusedFor` entry retention (built)

The "history-aware snapshot" idea from the plan was dropped; §1.5 makes it
unnecessary. What shipped instead is **entry retention** in `@ethlete/query`:
an entry that loses its last consumer is kept for `keepUnusedFor` ms rather than
destroyed, so a query that mounts again binds to it and renders its previous
response immediately while revalidating.

Why this shape: ~60 lines in one file, no new public concepts, no history
coupling, and it works on secure/authed routes (retention is not header-driven) —
the one thing the plan thought was impossible. Back-nav within the window renders
full-height content on frame 1 via the already-existing `hasCachedResponse`
loading state (§1.5), so layer 1's wait window ends on the first check instead of
waiting out a fetch.

### Decisions taken

| Question              | Decision                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Default               | **On, 5 minutes.** Team call: memory is not the binding constraint today, and a default-off knob helps nobody.        |
| Name / placement      | `keepUnusedFor`, on the client, overridable per query creator. `0` restores the old release-immediately behavior.     |
| Secure entries        | **Retained.** This is the case that needs it most — authed list routes are exactly where the header TTL does nothing. |
| Memory bound          | Hard cap of 50 unused entries per client, least recently orphaned dropped first (`MAX_UNUSED_ENTRIES`).               |
| What is worth keeping | Only entries that **hold a response**. In-flight and errored entries are aborted immediately, exactly as before.      |
| Server                | Retention is force-disabled (`retentionEnabled: false` from `createQueryClient`).                                     |

### How the open items resolved

- **Logout.** `unbindAllSecure()` no longer routes through `unbind` (which would
  now _retain_) — it clears the consumers and force-destroys, so a logged out
  session cannot leave an authenticated body sitting out its window. Pending
  evict timers are cleared in the shared `destroyEntry`, which `evict()` also
  uses now.
- **`previousKey` unbind path.** Left going through the same `unbind`, so an args
  change retains the old entry too (back/forward through filters is instant).
  This is what makes the LRU cap load-bearing rather than decorative: a
  search-as-you-type query produces a new cache key per keystroke.
- **Staleness policy.** No consumer changes were needed —
  `QueryExecutionStateLoadingWithCachedResponse` already existed and
  `rawResponse` is a `linkedSignal` off the bound request, so a returning query
  reads the retained body with no new API. Verified by a `createQuery`-level test
  that mounts, destroys, and remounts across two environment injectors.
- **Devtools.** `QueryRepositoryCacheEntry` gained `isUnused`, so a
  retained-but-orphaned entry reads as retained rather than as a leak.

### Only real behavior change worth flagging

A background **revalidation** in flight when the last consumer goes away is no
longer cancelled (the entry has a response, so it is retained and its refetch
runs to completion). First-time requests are still aborted on unbind as before.
Low impact, and it leaves the retained body fresher for the return trip.
