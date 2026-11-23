---
status: accepted
open: B680
decided: 2026-11-23
source: doc-agent session 2026-11-23, the human's shot of the tomflix run 2 sketch header
---

# The round picker uses the ghost select

The sketch round picker uses the form field variant `ghost` (ADR 0395) instead of the plain bordered select of ADR 0079.
It is as wide as the round name, so the name is not cut, and it has no clear button: a round picker never holds an empty
choice. The rest of the look is the builder's call.

The human, on the bordered picker: "haben wir nicht jetzt sogar eine borderless select die wir hier nutzen können? ich
meine da wurde eh eine gebaut." Asked with the recommendation "ghost, as wide as the round name, no clear button":
"q1ok".
