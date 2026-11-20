---
status: accepted
open: B356
decided: 2026-11-20
amends: 0386
source: grill session 2026-11-20 (afternoon), B356
---

# The zoom budget is measured in the CEF app

The zoom budget of the Studio canvas was set for WebKit, from the time the Mac app showed live parts in WKWebView, and
ADR 0386 let a Safari measurement on the Mac decide it. Since ADR 0242 the desktop app runs CEF (Chromium) on every
platform, and Studio is not planned to run in a browser. The human, on the Safari recordings (German, verbatim): "öhm
aber wir nutzen doch überall cef.", and "ok" on the proposal below.

The budget (p50 <= 20 ms, p95 <= 33 ms frame interval while zooming) holds for the desktop app with CEF, measured on the
Mac and on Linux. The Safari measurement is dropped; ADR 0386 now refers to the CEF app instead of Safari. The fix that
freezes the live frames during a zoom or pan gesture goes ahead in any engine. The row is renamed "Zoom-Budget im
Canvas".
