# Scroll restoration on back-navigation

**Status: planned, not started.** Own initiative — not part of the table or
pagination plans (a table/list is the main _consumer_, but this is a cross-cutting
`@ethlete/query` + navigation concern). Size: L (has a research/design fork).

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

## Open questions (resolve during design)

- Where does the nav-scoped store live — a `@ethlete/core` navigation util, or
  `@ethlete/query`? Who owns "settled"?
- Router integration: Angular Router `withInMemoryScrolling`/`scrollPositionRestoration`
  is the thing to _replace/augment_; confirm how it interacts.
- Interaction with virtualization (measured heights) and pagination (page changes
  are not back-nav — don't restore then).

## Deliverables (layer 1)

A restore-after-settle utility/service + a "settled" hook consumers (table, lists)
opt into, docs, changeset for whichever package owns it. Layer 2 gets its own
plan/changeset once designed.
