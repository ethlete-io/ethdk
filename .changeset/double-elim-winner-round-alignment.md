---
'@ethlete/cdk': patch
---

Align winner bracket rounds above their drop-in loser round

In the double elimination grid, winner bracket rounds that span two lower bracket columns were centered over that span, leaving them half a column off from the loser round they relate to. They are now left-aligned within the span so winner round n sits directly above the loser round its losers drop into (round 2n − 2) — the round whose matches merge into the next one — making the drop target unambiguous. The first winner round and the winner final are single-column and stay in place; lower rounds and other brackets are unaffected.
