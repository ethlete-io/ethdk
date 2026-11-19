---
status: accepted
open: B615
decided: 2026-11-19
source: doc-agent morning round 2026-11-19, fifa SDK finding #1 in plans/sdk/fifagg-sdk-findings-2026-11-15-seo.md
---

# Head bindings take a page or overlay layer

In the `@ethlete/core` head store the last created binding wins. In fifa an overlay (match details) sets the title, and
a page title bound later overwrites it; fifa removed its workaround. Offered (1) an optional `layer: 'page' | 'overlay'`
on the head binding options, (2) a free numeric priority, (3) only document the order and keep the fifa workaround.
The human: "Q2ok" (option 1, the recommendation).

The head binding options for title, meta and link get an optional `layer: 'page' | 'overlay'`, default `'page'`. An
`'overlay'` binding always wins over a `'page'` binding; within one layer the later created binding wins, as today.
Docs page and changeset are part of the change.
