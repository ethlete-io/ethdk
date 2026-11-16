---
status: accepted
built: 43721532c
decided: 2026-11-16
source: doc-agent session 2026-11-16, B527 report (whole-pixel panes, ADR 0311)
---

# Whole-pixel panes are Chromium-only until calc-size lands elsewhere

ADR 0311 sizes overlay panes and tooltips on whole pixels through CSS `calc-size()`, which only Chromium supports today.
In Firefox and Safari pane sizes stay fractional, as before. Studio is not affected: it runs CEF on every platform
(ADR 0242, 0249). Offered (a) accept Chromium-only, the other engines gain it when they ship `calc-size()`; (b) a
JavaScript measure-and-round fallback, which goes stale when the text changes while the pane is open. The human:
"q1ok" (option a, the recommendation).

Whole-pixel pane sizing stays Chromium-only. No JavaScript fallback is built for Firefox or Safari.
