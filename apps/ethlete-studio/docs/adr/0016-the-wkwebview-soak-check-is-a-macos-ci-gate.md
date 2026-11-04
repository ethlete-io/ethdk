---
status: accepted
open: none
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "WebKit soak check decisions" (finding 365) item 1
---

# The WKWebView soak check is a macOS CI gate

A CI job on a macOS runner holds the real event stream of `et design serve` in an offscreen WKWebView for 90 s and
fails on any close; it runs only when `apps/ethlete-studio` or the design CLI change. No local-only hook, because
WebKit faults only show on a Mac and a hook can be skipped.
