---
status: accepted
open: B527
decided: 2026-11-16
source: doc-agent session 2026-11-16, morning round
---

# SDK panes sit on whole pixels

SDK panes and tooltips are sized and placed on fractional pixels (a 189.625 px wide title-bar notice moved by a
transform), so borders smear over two pixel columns; the SDK tooltip design mock places by left/absolute while the app
places by translate3d. Asked whether core should size and place panes on whole pixels, and the tooltip mock place the same
way, with the recommendation yes, the human answered "q4ok".

Core sizes and places overlay panes and tooltips on whole pixels, and the tooltip design mock places them the same way.
The title-bar notice, zoom-chip tooltip and shell-collapse focus-visible residuals in parked-suspects move into this row.
