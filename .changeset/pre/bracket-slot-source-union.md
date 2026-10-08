---
'@ethlete/bracket': major
'@ethlete/components': major
---

Breaking: `BracketSlotSource` is now a union discriminated by `kind` that carries only the fields of its kind; build slots with the new `bracketSlot.*` constructors.
