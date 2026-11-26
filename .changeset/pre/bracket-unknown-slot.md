---
'@ethlete/bracket': minor
'@ethlete/components': minor
---

Add the `unknown` slot kind (`bracketSlot.unknown(label?)`): it keeps its label and links no feeder. A `match-outcome` slot accepts `role: null`, read as the winner. Exhaustive switches over `BracketSlotSourceKind` need an `'unknown'` case.
