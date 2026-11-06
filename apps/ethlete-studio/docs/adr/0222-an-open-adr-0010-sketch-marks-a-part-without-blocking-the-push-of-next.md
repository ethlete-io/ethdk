---
status: accepted
open: B417
decided: 2026-11-07
source: doc-agent session, grill round after finding 544
---

# An open ADR 0010 sketch marks a part without blocking the push of next

Tom: "q2ok". When the app shows UI the design does not draw, ADR 0010 opens a sketch at once with the built look as
variant a. Until Tom picks, the compare DIFFs that this sketch covers mark the part instead of failing the pre-push gate
of `next`: the gate lists them with the sketch name, and the push goes through. The mark covers only the regions or
states the open sketch names; any other DIFF on the part still fails. After the pick is merged, the part must compare
green again. Example: `pages/sketches@all-states` ("Alle Zustände zeigen" and the state fold).
