---
status: accepted
built: 789031753
decided: 2026-11-09
source: doc-agent session 2026-11-09, morning round after the night of ADR 0228
---

# The sketch compare draws the fresh second pair only after a cached first pair

The human: "Ok" to the recommendation: the compare draws the fresh second pair (`drawnPair`) only when the first pair
came from the picture cache.

The second draw exists to keep a stale cached picture out of the result. It is half of all draws, and it made the
first cold compare take 150-280 s locally (finding 598). A first pair that was drawn fresh needs no second draw.
