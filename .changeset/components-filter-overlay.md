---
'@ethlete/components': minor
'@ethlete/query': patch
---

Filter overlay: new `provideFilterOverlay` / `injectFilterOverlay` — a filter panel that drafts the page's query
form, reports how many results the draft would return on its submit button, and applies on submit or discards on
dismiss. Replaces cdk's `FilterOverlayService`, rebuilt on signal forms and the current query client.
