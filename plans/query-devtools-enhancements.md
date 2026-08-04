# Query devtools: enhancement backlog

Source-verified pass (2026-08-04) over the shipped panel
(`libs/components/src/lib/query-devtools/`) and its instrumentation
(`libs/query/src/lib/devtools/`), as of `03b6aec1a`. Unprioritized backlog -
pick items into real plans as needed. Everything below is a gap in the panel as
it stands, not a restatement of what already works.

What already ships (don't rebuild): per-query activity counters, feature configs
with resolved defaults, resolved route params, the value explorer with search and
persisted folding, JIT response/args editing, forced states, Insomnia export with
a self-refreshing token chain, the inspect tool, the cache tab with multi-tab
sync + persistence state, and the rolling event log. See
`apps/docs/components/query-devtools.md`.

## Highest value

### 1. Filter the Queries list, and count on the tabs — shipped

Shipped 2026-08-04: a filter box over method / resolved route / request URL /
client name (all whitespace-separated terms have to hit), **Failing** /
**Loading** / **Stale** chips carrying their match count and widening when
combined, an `N of M` count, and per-tab entry counts with a red failing badge.
Documented under
[Finding a query in a long list](../apps/docs/components/query-devtools.md).

### 2. Per-request history instead of aggregates only — shipped

Shipped 2026-08-04: a 25-run ring buffer on `QueryDevtoolsStatsHandle.runs`
(`query-devtools-stats.ts`), retaining the newest 5 response bodies, with
`pending` / `success` / `error` / `aborted` statuses and per-run URLs. On top of
it: a **Timeline** tab drawing every request on one shared axis, and a
**History** section per query with a path-level **response diff**
(`query-devtools-diff.ts`, matching records by `id`). The query detail was split
into Overview / History / Data sub-tabs at the same time. Documented under
[Timeline](../apps/docs/components/query-devtools.md) and
[Run history and response diffs](../apps/docs/components/query-devtools.md).

### 3. Retry and progress are invisible

`libs/query/src/lib/http/query-retry-utils.ts` exists; nothing in the panel
mentions attempts. `latestHttpEvent` is read only for its `status`
(`query-devtools.component.ts:1337`), so upload/download progress is dropped.

A query stuck `loading` for 8s because it is on attempt 3 behind a 4s backoff
looks identical to a slow request. Surface the attempt count and a backoff
countdown on the detail head, and a progress bar for requests that report one.

### 4. Fault injection, not frozen states

`forceLoading` / `forceError` (`query-devtools.component.ts:813-838`) set signals
directly. That exercises the template but bypasses the pipeline - retries, error
handling features, cache behaviour. Add per-client:

- inject N ms of latency into every response,
- fail the next request / fail N% of requests.

That is what catches a missing skeleton or a retry that never fires.

## Subsystems with no instrumentation at all

### 5. Query forms

`libs/query/src/lib/query-form` and `libs/query/src/lib/query-form-signals`
register nothing with the devtools registry (verified: no `devtools` reference in
either folder). A whole documented subsystem (`apps/docs/query/query-forms.md`)
is invisible.

A Forms tab would show, per form: current value, the query params it derives,
which query it drives, and whether it sits at its defaults. New coverage rather
than a refinement of existing coverage.

### 6. Invalidation and dependency fan-out

`query-invalidation.ts` and `query-dependencies.ts` exist. The panel shows
`triggeredBy()` per query but no edges: when a mutation invalidates six queries,
nothing says it happened or which six. Add an event-log row for an invalidation
plus a dependents list on the query detail. This is the "why did this refetch?"
question, which the panel currently cannot answer.

## Cheap wins

| Item                          | Notes                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy as cURL**              | `insomniaRequest()` (`query-devtools.component.ts:1121`) already resolves method, URL, headers and body. curl is what goes in a terminal or a ticket; Insomnia import is heavy for that.                                |
| **Clickable event rows**      | Selecting the owning query. The Events tab is a dead end today - no tab links to another.                                                                                                                               |
| **Duration + size in Events** | `EventLogItem` (`query-devtools.component.ts:79`) carries neither. Plus a client filter and an errors-only toggle.                                                                                                      |
| **Whole-session export**      | `copyReport` is per query. One JSON dump of every entry, its activity and the event log is what you attach to a bug report.                                                                                             |
| **Cache tab depth**           | Total cached bytes per client, evict-all, and inspecting a cached entry's value - today you can only Refetch/Evict, so an entry with no live query is opaque. Mark `consumerCount: 0` entries as about to be collected. |
| **Sockets tab depth**         | Filter messages by event/room, and an emit box for test messages. `WebSocketDevtoolsHandle` (`libs/query/src/lib/ws/web-socket-client.ts:30`) records received messages only - outgoing traffic is not captured.        |
| **Dock right / pop out**      | Bottom dock only (`applyResize` assumes it, `query-devtools.component.ts:1250`). The right edge is better on a wide screen; a `window.open` pop-out is better on two monitors.                                          |

## Considered and skipped

- **Error grouping / 401-storm detection.** With the errors-only filter (item 1)
  you would see it anyway; a dedicated aggregation is demo polish.
- **Configurable `MAX_EVENTS`.** 100 (`query-devtools.component.ts:111`) has not
  been the limiting factor; the missing columns and filters are.

## Suggested order

1 and 2 are shipped. Next is 3 (retry / progress visibility, which the run
history now has a natural home for - an attempt count per run). 5 is the largest
single coverage win if breadth matters more than depth.
