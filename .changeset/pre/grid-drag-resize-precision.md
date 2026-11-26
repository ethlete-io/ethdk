---
'@ethlete/components': patch
---

Grid: rework drag and resize on a unified pixel/span geometry model so the live preview, the clamped pixel rect, and the snapped grid position can no longer disagree. This fixes item drift and overlap during fast drags and resizes near the grid bounds, keeps items within their configured min/max span constraints, and makes a drag snap to the pointer on commit instead of trailing it by the drag threshold.
