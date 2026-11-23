---
status: superseded by 0424
open: B356
decided: 2026-11-22
source: doc-agent session 2026-11-22 (evening), B356
---

# The builder may measure the GPU zoom on the human's desktop

The canvas zoom budget (ADR 0390) was measured in the CEF debug host under Xvfb only, with software rendering: p50 16.7
ms, p95 16.8 ms. A real GPU run needs a Studio CEF window on a real desktop. The doc agent recommended that the builder
opens one on the human's desktop for about 2 minutes while the human is at the PC, zooms through CDP and never takes the
pointer, and measures on the Mac otherwise. The human (German, verbatim): "q1ok".

While the human is at the PC, the builder may open a Studio CEF window on the desktop for the zoom measurement, driven by
CDP only. When the human is away, the measurement runs on the Mac.
