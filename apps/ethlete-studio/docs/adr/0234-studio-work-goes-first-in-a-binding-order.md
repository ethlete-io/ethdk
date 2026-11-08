---
status: accepted
open: B249
decided: 2026-11-09
source: grill session 2026-11-09, findings 625-638
---

# Studio work goes first, in a binding order

A whole day went into tool and test fixes, and no Studio work moved. The human: "wir treten echt 95% der zeit auf der
stelle" and "es darf nie wieder passieren das du die komplette nacht durch e2e fixen musst". The order in
`plans/ethlete-studio/STATUS.md` ("Gerade in Arbeit") is binding: the builder takes the top open item, checks it against
git first, and never reorders it; only the doc agent changes the list, after the human's OK. A new finding interrupts the
current item only when CI is red (ADR 0230) or when it blocks that item; otherwise its tool fix joins the tool backlog,
which the builder works only while it waits for a sketch pick. No item runs as an overnight e2e fix loop. Nothing on the
go system is changed before B249 removes it (ADR 0048). The human: "passt".
