# Scroll restoration on back-navigation

**Status (2026-07-25): complete — both layers shipped.** The
research/design fork is closed — see
[`scroll-restoration-design.md`](./scroll-restoration-design.md) for the findings,
the options weighed, and the decisions. Read that file first; the sections below
are the original framing and are partly superseded (notably §2's cache
assumptions — see design doc §1.5).

Own initiative — not part of the table or pagination plans (a table/list is the
main _consumer_, but this is a cross-cutting `@ethlete/query` + navigation
concern). Size: L.

## Problem

Native browser scroll restoration is wrong for our query-driven list pages. On
(back-)navigation the page re-renders, its queries re-execute and show
loading/empty/skeleton states, so the document is **much shorter** than it was when
the data had loaded and the lists/cards had rendered their full height. The browser
restores the saved scroll offset immediately — against that short document — so it
lands nowhere near where the user was. Turning off native restoration and doing
nothing is no better.

## Direction

Two layers, build the first now:

1. **Restore-after-settle (first implementation).** Don't restore on the loading
   frame. Capture the intended scroll offset per navigation (history `state` / a
   navigation id) on leave, and re-apply it only once the relevant data has
   _settled_ and the content has rendered its real height. Needs:
   - a navigation-scoped store keyed by nav id (survives the round-trip);
   - a "content settled" signal the page/list can report (e.g. a hook on
     `scrollable`, or the table emitting when `rows()` + heights are stable — ties
     into virtualization's measured heights);
   - re-apply strategy: wait for settle (with a sane timeout/fallback), then set
     `scrollTop`; handle the case where the target is now shorter (clamp).
2. **Smart back-nav data cache (deeper, separate design).** So the list data is
   present _immediately_ on back-nav (no loading state at all), which also largely
   sidesteps the height problem. This goes **beyond** the query package's current
   TTL cache — think a navigation/history-aware snapshot of query results (and
   maybe rendered state) restored synchronously on `popstate`. This is a real
   `@ethlete/query` architecture fork; scope and prototype it on its own before
   committing. Do NOT block layer 1 on it.
   - **Candidate simplification (shower thought):** rather than a whole new
     snapshot mechanism, just **keep stale query results in the cache** (retain past
     TTL / don't evict on back-nav) so the data is already there on return — a much
     smaller change than a bespoke history cache, and it makes layer 1 easy (the
     list renders full height immediately, so restoration is trivial). Worth
     evaluating first.
   - **Caveat — caching is off on ~all private/authed routes.** So the cache lever
     (either flavour) does nothing there; those routes MUST still work via layer 1's
     restore-after-settle. Treat the cache as an optimization for public/cacheable
     routes, not the mechanism — layer 1 is the baseline that always applies.
     (Also think about staleness: showing stale data on return then refreshing —
     acceptable? per-route opt-in? memory bounds on retained results?)

## Open questions — all resolved

Answers and rationale in
[`scroll-restoration-design.md`](./scroll-restoration-design.md) §3. In short:
the nav-scoped store lives in `@ethlete/core` inside `setupScrollRestoration`;
nobody owns "settled" (the scroll container's own height is the signal, with an
optional `holdScrollRestoration()` override); `withInMemoryScrolling` is not used
(only Angular's `navigationId` keying is borrowed); virtualization needs no
changes; and only `popstate` navigations with a stored offset restore, so
pagination via a link still scrolls to top.

## Deliverables

**Layer 1 — done** (`@ethlete/core`, changeset `core-scroll-restoration`):

- `setupScrollRestoration({ restore: { enabled, timeout, maxTimeout, clampOnTimeout } })`
  captures the offset per history entry and re-applies it once the content is tall
  enough to reach it; abandons the attempt if the user scrolls.
- `holdScrollRestoration(() => query.isLoading())` — optional per-page suspension
  of the wait, for data slower than `timeout`.
- `scrollElement` now also accepts a getter, for per-route / app-shell scrollers.
- Docs: `apps/docs/core/signal-utils.md` → "Navigation scrolling & scroll
  restoration". Tests: `libs/core/src/lib/signals/recipes/scroll-restoration.spec.ts`.

**Layer 2 — done** (`@ethlete/query`, changeset `query-keep-unused-for`):

- `createQueryClient({ keepUnusedFor })` (default 5 min, overridable per creator,
  `0` restores the old behavior) keeps a cache entry alive after its last consumer
  is destroyed, so a returning query renders its previous response immediately
  while revalidating. Independent of `cache-control`, so it covers authed routes.
- Only entries holding a response are kept; capped at 50 unused entries per
  client; disabled on the server; force-cleared on logout.
- Docs: `apps/docs/query/caching.md` → "Keeping unused entries around".

Built as entry retention rather than the bespoke history snapshot the original
plan imagined — see the design doc §1.5 and §5 for why.
