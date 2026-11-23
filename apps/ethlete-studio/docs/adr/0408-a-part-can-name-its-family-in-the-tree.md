---
status: accepted
open: B673
decided: 2026-11-23
source: doc-agent session 2026-11-23 (morning), B673
---

# A part can name its family in the tree

Amends ADR 0294 and ADR 0332 (a part nests under its only user; nothing declares the nesting). `components/comment-pin`
has four users (comment-flow, variant-cell, pages/inbox, pages/sketches) and `components/comment-row` three, so both stay
flat beside `comment-flow`. The human (German, verbatim): "zudem hatte ich geschriben dass das guppieren wohl noch
optimiert werden muss. das ist immernoch offen. sonst wäre denke ich comment-pin und comment-row teil von
comment-flow?" The earlier note was not recorded anywhere.

Asked with three options (the design names the family; a guess from the name prefix; nest under the user in the same
layer), the doc agent recommended the first. The human: "q7 ok".

1. **A part's design can name its family**, for example comment-pin belongs to comment-flow. The tree shows it under
   that part, whatever number of parts use it.
2. **Without a family, ADR 0332 applies**: a part with exactly one user nests under it.
