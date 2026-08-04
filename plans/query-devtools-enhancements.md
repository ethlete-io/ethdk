# Query devtools: enhancement backlog

Everything this backlog listed has shipped (2026-08-04): list filter and per-tab counts, a
25-run ring buffer with timeline and response diff, retry attempts and transfer progress,
fault injection, query-form instrumentation, invalidation fan-out, and then the cheap wins -
copy as cURL, duration and size in Events with a client filter and an errors-only toggle,
whole-session export, cache sizes / values / evict-all, socket outgoing capture with an emit
box and a message filter, and dock-right / pop-out.

For what the panel does today read `apps/docs/components/query-devtools.md`; it is the current
surface, and anything already there is not worth rebuilding. What follows is only the record of
what was deliberately left out.

## Considered and skipped

- **Error grouping / 401-storm detection.** With the errors-only filter on the event log you
  would see it anyway; a dedicated aggregation is demo polish.
- **Configurable `MAX_EVENTS`.** 100 (`query-devtools.component.ts`) has not been the limiting
  factor; the columns and filters were.

## Deliberately not instrumented

The legacy reactive-forms `QueryForm` (`libs/query/src/lib/query-form`) has no devtools
entry - it is superseded by `createQueryForm` and the devtools handle is signals-shaped.
Instrumenting it means bridging `currentValue$` / `activeFilterCount$` and rebuilding the
field descriptors off `FormGroup` controls. Only worth it if a consumer is stuck on it.
