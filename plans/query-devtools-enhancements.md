# Query devtools: enhancement backlog

Source-verified pass (2026-08-04) over the shipped panel
(`libs/components/src/lib/query-devtools/`) and its instrumentation
(`libs/query/src/lib/devtools/`), as of `03b6aec1a`. Unprioritized backlog -
pick items into real plans as needed. Everything below is a gap in the panel as
it stands, not a restatement of what already works.

The six items this pass judged highest-value all shipped 2026-08-04 (list filter and
per-tab counts, a 25-run ring buffer with timeline and response diff, retry attempts
and transfer progress, fault injection, query-form instrumentation, invalidation
fan-out). For what the panel does today, read
`apps/docs/components/query-devtools.md` rather than a plan - it is the current
surface, and anything already there is not worth rebuilding.

## Cheap wins

| Item                          | Notes                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy as cURL**              | `insomniaRequest()` (`query-devtools.component.ts:1121`) already resolves method, URL, headers and body. curl is what goes in a terminal or a ticket; Insomnia import is heavy for that.                                |
| **Duration + size in Events** | `EventLogItem` (`query-devtools.component.ts:79`) carries neither. Plus a client filter and an errors-only toggle.                                                                                                      |
| **Whole-session export**      | `copyReport` is per query. One JSON dump of every entry, its activity and the event log is what you attach to a bug report.                                                                                             |
| **Cache tab depth**           | Total cached bytes per client, evict-all, and inspecting a cached entry's value - today you can only Refetch/Evict, so an entry with no live query is opaque. Mark `consumerCount: 0` entries as about to be collected. |
| **Sockets tab depth**         | Filter messages by event/room, and an emit box for test messages. `WebSocketDevtoolsHandle` (`libs/query/src/lib/ws/web-socket-client.ts:30`) records received messages only - outgoing traffic is not captured.        |
| **Dock right / pop out**      | Bottom dock only (`applyResize` assumes it, `query-devtools.component.ts:1250`). The right edge is better on a wide screen; a `window.open` pop-out is better on two monitors.                                          |

## Known bug, found in passing

`HttpRequestLoadingProgressState.speed` is wrong by a factor of 1000.
`updateLoadingState` (`http-request.ts`) computes bytes/ms into a local and then
assigns `progress.speed = speed * 1000`, while the JSDoc claims bytes/**ms**.
`remainingTime` is correct - it uses the local. The devtools progress readout omits
speed for this reason, so fixing the unit means deciding which one the field is and
updating both the JSDoc and the panel.

## Considered and skipped

- **Error grouping / 401-storm detection.** With an errors-only filter on the event
  log you would see it anyway; a dedicated aggregation is demo polish.
- **Configurable `MAX_EVENTS`.** 100 (`query-devtools.component.ts:111`) has not
  been the limiting factor; the missing columns and filters are.

## Deliberately not instrumented

The legacy reactive-forms `QueryForm` (`libs/query/src/lib/query-form`) has no devtools
entry - it is superseded by `createQueryForm` and the devtools handle is signals-shaped.
Instrumenting it means bridging `currentValue$` / `activeFilterCount$` and rebuilding the
field descriptors off `FormGroup` controls. Only worth it if a consumer is stuck on it.
