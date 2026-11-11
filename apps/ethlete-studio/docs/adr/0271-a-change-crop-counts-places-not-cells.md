---
status: accepted
built: 82c6e3025
decided: 2026-11-11
source: grill session 2026-11-11 (night), Mac B345 slice 1
---

# A change crop counts places, not cells

The sketch round shows each changed state as a crop of its change. The design said "1358 px in 3 Zellen", but a pixel
diff cannot know cells; it finds groups of changed pixels that lie close together. The label says "N Stellen". The human
was asked "Soll es „Stellen“ bleiben?" with the recommendation yes, and answered "q1ok".
