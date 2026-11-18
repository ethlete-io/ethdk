---
status: accepted
open: B189
decided: 2026-11-18
source: doc-agent session 2026-11-18 (morning round), the human on compare tolerance for round edges
---

# Compare passes an isolated antialias pixel on round edges

The shared antialias rule for SDK pane corners (ADR 0115) did not cover round edges, so every pages/inbox state stayed
red on one pixel of the "Erledigte zeigen" switch-track arc (delta 10-21) and one glyph edge (delta 12). The permission
classifier refused the builder's write to the compare gate without the human's consent. The doc agent asked; the human
answered "ok".

- Part compare passes a pixel over the tolerance as antialias only when none of its 8 neighbours is over the tolerance
  and the design and app values each lie inside the other picture's 3x3 range on every channel.
- Only part compare uses it; merge-compare and change-box stay unchanged.
- A spec proves a real arc pixel passes, the same pixel at 200 fails, and an 18 px disc shifted 1 px fails.
