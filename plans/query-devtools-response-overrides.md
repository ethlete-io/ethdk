# Query devtools: persistent response overrides + a tamper indicator

Today's response editing is a single ephemeral poke: `openResponseEditor` seeds a raw-JSON
textarea from `query.response()` and `applyResponse` calls `query.subtle.setResponse(...)`
(`libs/components/src/lib/query-devtools/query-devtools.component.ts:1648-1726`). That write lands
on a `linkedSignal` that re-derives from the live `request` signal
(`libs/query/src/lib/http/query-state.ts:106-114`), so it is silently discarded the next time the
query executes - there is no field anywhere named `override`/`mock`/`isEdited`, and nothing shows a
query is currently showing anything other than what the server sent. Fault injection
(`libs/query/src/lib/devtools/query-devtools-faults.ts`) already solved the "persist a devtools
decision per query, reapply it on every future execution" problem for a different axis (latency /
forced failure) via an armed-per-client registry that the request pipeline consults. This plan
gives response editing the same shape - a persistent, path-addressed override registry keyed by
query key, reapplied on every (re)fetch - and adds one indicator that lights up for *either*
mechanism, since both mean "what's rendering right now isn't what the server actually returned."

## Design: operations, not snapshots

An override is not "replace the whole response with this JSON blob" (that's what the existing
editor already does, and why it can't survive a refetch - a new response has no relation to the
frozen blob). It's a small ordered list of **path-addressed operations**, resolved against
whatever the live response actually is at apply time:

```ts
type OverrideOp =
  | { type: 'set'; path: JsonPath; value: JsonValue }
  | { type: 'stringPreset'; path: JsonPath; preset: 'short' | 'long' | 'unicode' | 'custom'; custom?: string }
  | { type: 'numberPreset'; path: JsonPath; preset: 'zero' | 'negative' | 'huge' | 'custom'; custom?: number }
  | { type: 'booleanFlip'; path: JsonPath }
  | { type: 'datePreset'; path: JsonPath; preset: 'now' | 'plusDay' | 'minusDay' | 'farFuture' | 'farPast' | 'invalid' }
  | { type: 'duplicateArrayItem'; path: JsonPath; index: number }
  | { type: 'duplicateArray'; path: JsonPath }
  | { type: 'paginationResize'; path: JsonPath; mode: 'shrink' | 'extend'; amount: number }
  | { type: 'reset'; path: JsonPath };
```

A `path` is a JSON-pointer-style array of keys/indices captured from wherever the user opened the
menu in `query-devtools-json.component.ts`'s tree. On every execution the registry walks the same
path into the *new* raw response and applies the op there; if the path no longer resolves (the
shape changed), that op is skipped and flagged stale rather than thrown - overrides degrade, they
don't crash the query. This is also what makes "recursive fill" tractable: "fill every string
under this subtree" is materialized once, at the moment it's chosen, into one `set` op per matching
leaf path found in the *current* value - it's not a live rule that keeps re-scanning new shapes, so
it stays a flat, listable, individually-clearable set of ops like everything else in the registry.

**Smart duplication.** `duplicateArrayItem`, `duplicateArray`, and `paginationResize: extend` all
go through one shared helper that clones an object but regenerates anything that looks like an
identity: keys matching `/^id$/i`, `/(^|[a-z])Id$/`, `/^uuid$/i`, `/^key$/i`, or a sibling-unique
string/number value, get a fresh synthetic value (numeric ids bump past the current max in the
array; string ids get a `-copy-N` suffix) instead of a literal copy. Without this, duplicating a
row produces two entries with the same id, which breaks `track` bindings and any detail lookup by
id - the exact failure a "duplicate" action exists to avoid causing.

**Pagination shrink/extend.** Reuses the shapes already defined in
`libs/types/src/lib/pagination.types.ts` (`NormalizedPagination`, `GgLikePaginated`,
`DynLikePaginated`, `ContentfulGqlLikePaginated`) as the structural check: an object qualifies if it
has an `items: unknown[]` plus any of the known total/page/limit key combinations. Shrink drops N
items from `items` and decrements the counters proportionally; extend duplicates items (via the
same smart-duplicate helper) and increments them. One operation instead of hand-editing four
counter fields and getting them inconsistent with `items.length`.

**Date detection.** A leaf is offered date presets when its key matches `/date|At$|Timestamp/i`
*and* its value round-trips through `Date.parse`, or the value itself matches an ISO-8601
date/datetime pattern regardless of key name. Presets: now, +1 day, -1 day, far future (e.g. 2099),
far past (epoch), and a deliberately invalid string - the last one exists because "the API sent a
date my code can't parse" is a real bug class worth being able to reproduce on demand.

## Phase 0 - split the monolith before adding to it (M)

`query-devtools.component.ts` is 2801 lines and its template another 2066
(`libs/components/src/lib/query-devtools/query-devtools.component.ts` /
`.html`). Landing a per-value action menu (phase 2) and a tamper badge (phase 3) in the same file
only makes an already hard-to-navigate component worse. Split by tab first:

- One child component per top-level tab (`DevtoolsTab`: queries, stacks, sequences, forms, auth,
  ws, cache, timeline, events, faults) - its own `.ts`/`.html`/`.css`, rendered only while selected.
  Matches the reasoning AGENTS.md already gives for splitting a large stylesheet ("CSS for a base
  capability... mounted on demand... saves injection and recalculation") extended to the whole tab,
  not just its CSS: most sessions only ever open two or three tabs.
- The per-query detail drawer (`DetailTab`: overview/history/data) is its own concern nested inside
  the queries tab - split it the same way, one child per sub-tab.
- Shared cross-tab state (selected entry, search/filter, which tab is active) moves into one small
  injectable provided at the `<et-query-devtools>` level; each tab/drawer child `inject()`s it
  instead of the parent threading a long `@Input()` list down. Same shape as `TableFeatureHost` in
  the table's feature-registration seam (`plans/table-api.md`) - a host a consumer reads from,
  not prop drilling.
- Leave what's already extracted alone: `query-devtools-json.component.ts` (the Data sub-tab) and
  the two styles-only components mounted via `injectStyleManager()`. This phase is about the tabs
  still inline in the parent, not redoing work already split out.
- Ship this on its own before phases 1-3 start, as a behavior-neutral refactor - it's much easier to
  place the override menu and tamper badge correctly inside an already-extracted ~200-300 line tab
  component than to thread them into the current single file.

## Phase 1 - override registry (`@ethlete/query`, headless) (M)

- New `libs/query/src/lib/devtools/query-devtools-overrides.ts`, structured like
  `query-devtools-faults.ts`: `armOverride(client, key, op)`, `listOverrides(client, key)`,
  `clearOverride(client, key, opId)`, `clearAllOverrides(client, key)`, all no-ops when
  `isQueryDevtoolsEnabled()` is false, same dead-code-elimination guarantee every other devtools
  hook already gives production bundles.
- **Hook point is a new seam, not the fault seam.** `query-devtools-faults.ts` is armed per
  *client name* and resolved by `resolveQueryDevtoolsFault({ clientName, method, url })` inside
  `http-request.ts:342-350`, entirely below the query layer - before retries, before any query has
  a `response`. It can't be reused here: an override is keyed by *query key* and needs to act on the
  value a query actually ends up holding, so it hooks in one layer up, at the same point
  `query.subtle.setResponse` writes today (`query-state.ts`'s `rawResponse` `linkedSignal`,
  `libs/query/src/lib/http/base-query-factory.ts`). Concretely: after a real response resolves (or a
  cached one is served), and before it settles into `rawResponse`, walk it through
  `listOverrides(client, key)` and apply whatever still resolves. Gated behind
  `isQueryDevtoolsEnabled()`, same as the rest of the module.
- The smart-duplicate helper and pagination-shape check are pure functions here, shared by the UI
  for preview and by the pipeline for actual reapplication - one implementation, not two that can
  drift.

## Phase 2 - type-aware overrides menu (`@ethlete/components`, UI) (L)

Extends `query-devtools-json.component.ts`'s per-node rendering (it already computes `kindOf`/
`JsonKind` per node, today only for display) with an action affordance per node.

- **Menu component decision**: reuse the real `<et-menu>` / `menu-context-trigger.directive.ts`
  (`libs/components/src/lib/menu/`) rather than extending the panel's hand-rolled overflow menu
  (`query-devtools.component.html:51-66`). The hand-rolled pattern exists to keep the panel's own
  chrome light for apps that drop it into a shell; a per-value action menu is a different kind of
  surface (many instances, needs keyboard nav/typeahead/positioning) that the menu system already
  solves, and the whole devtools panel is dev-only weight to begin with. Flagging this as a decision
  rather than a given - revisit if bundle measurement disagrees.
- **Per-kind menu contents:**
  - `string` - short text, long text, unicode/RTL sample (layout stress-testing), custom text, reset.
  - `number` - zero, negative, huge (overflow stress-testing), custom, reset.
  - `boolean` - toggle, reset.
  - date-shaped string (see detection above) - now / +1 day / -1 day / far future / far past /
    invalid, reset.
  - `array` - duplicate array, fill recursively (below).
  - object that is an array element - duplicate this item (smart id remap), reset.
  - object matching a pagination shape - shrink page, extend page.
  - any `object`/`array` node - **fill recursively**: string/number/boolean preset applied to every
    matching descendant leaf under that subtree, materialized as individual `set` ops.
  - every node - reset (clears just this path's op(s)); the panel keeps a per-key "reset all"
    action for clearing everything at once.
- Whether "duplicate array" doubles the whole array's contents or appends one duplicate of a chosen
  item reads either way from the ask - default to doubling the whole array (matches "duplicate
  array" read literally), call out during spec so it isn't silently the other interpretation.

## Phase 3 - tamper indicator (UI) (S/M)

- **The two halves of "tampered" are not the same shape of fact, and the badge has to be honest
  about that.** An override is exact and query-keyed - the registry lookup is the fact. A fault is
  armed per *client* (`clientName`, matched by `method`/`url` inside `http-request.ts`, no query key
  involved), and armed-but-idle is not the same as "this response was actually altered" - a 10%
  `failRate` mostly lets requests through untouched. Badging every query on a client the moment any
  fault is armed on it would over-claim for the vast majority of them. So: build the same kind of
  fact the override side already has - **did this specific query's last response actually get
  faulted** - not "is a fault currently armed somewhere upstream."
  - `QueryDevtoolsStats` (`query-devtools-stats.ts`) already derives `errors`/`retries` per query
    from the same event stream every response flows through; it has no fault-specific field yet.
  - `sendWithFaults` in `http-request.ts:342-364` already knows, per attempt, whether
    `resolveQueryDevtoolsFault` fired and with what outcome. Tag that outcome onto the emitted
    event/response (the same event `query-devtools-stats.ts` already listens to) so the stats
    recorder can set a new `lastResponseWasFaulted: boolean`, computed the same way `errors` already
    is from that stream - a small, scoped addition to two existing files, not new infrastructure.
  - Tampered badge = `hasOverride(key) || stats(key).lastResponseWasFaulted` - both sides now mean
    the same thing: this exact response differs from what the server actually sent, not "something
    nearby might."
- Badge in the query list row and the detail drawer header, reusing whatever status-pill pattern
  the panel already renders for loading/error state rather than inventing new CSS.
- The same combined signal puts a small dot on the floating toggle
  (`query-devtools-toggle.component.ts`), which renders in its own shadow DOM outside the panel -
  this is what makes the indicator visible with the panel closed, i.e. visible in the running app,
  not just inside the drawer.
- Deliberately not a new field on `QueryState`/`Query` - both registries already live in
  `@ethlete/query`'s devtools module and are already no-ops until `provideQueryDevtools()` runs;
  keeping the indicator's source of truth there (rather than on core query state) keeps that
  guarantee intact.

## Phase 4 - session export + docs (S)

- Check whether `query-devtools-session.ts`'s export/import already round-trips armed faults; if
  so, fold override rules into the same payload so a shared session file reproduces both. If faults
  themselves don't survive a reload today, say so explicitly rather than quietly deciding overrides
  should behave differently - default to "in-memory only, resets on reload" for v1 and record it as
  a known gap, not a silent omission.
- Update `apps/docs/components/query-devtools.md`. The existing "JIT editing" / "Force states"
  bullets (around line 713-720, under "Beyond a read-only view") describe exactly the mechanism this
  plan replaces for anything path-addressable - decide whether they become "the quick one-off raw
  edit, for when a path-based override is overkill" or get folded into the new section entirely.
  Either way, a reader of that page should come away knowing which of the two to reach for.

## Non-goals for v1

- Route-level "apply to any args" override templates - this plan is scoped to one query key at a
  time, matching how faults are armed today.
- Overrides surviving anything beyond the current page session, unless phase 4 finds faults already
  do via session export.
- Editing request args through this menu - already covered by the existing "Replay args" editor.

## Open questions

- Pagination-shape detection is structural and could false-positive on a real domain object that
  happens to have `items` + a `total`-shaped field. Leaning toward not auto-offering the
  shrink/extend actions silently everywhere the shape matches, and instead requiring the shape match
  *and* the entry being a `paged-query-stack` kind, or an explicit "treat as pagination" toggle in
  the menu if that's too restrictive in practice.
- Whether a *client* with an armed-but-not-yet-triggered fault deserves any indicator at all (e.g. a
  dimmer "armed nearby" hint on every query on that client, distinct from the solid "tampered"
  badge). Phase 3 as written deliberately leaves this out - armed-but-idle isn't tampering - but it's
  a legitimate "heads up" signal if a future pass wants it, as long as it stays visually distinct
  from "this response was actually altered."

## Verification & shipping

- Extend `stories/query-devtools-demo.utils.ts` fixtures with a pagination-shaped response and an
  array of objects with id-like fields, so phase 2's duplicate/pagination presets have something
  real to exercise in Storybook.
- Drive the new menu actions and the tamper badge headlessly per the `verify-in-storybook` skill
  before calling any phase done.
- Three changesets: `@ethlete/components` (phase 0's tab split, patch - no behavior change),
  `@ethlete/query` (new overrides registry, minor), and `@ethlete/components` again (menu UI +
  indicator, minor) - see the `changeset` skill.
