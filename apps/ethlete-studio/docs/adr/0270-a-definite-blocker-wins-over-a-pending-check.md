---
status: accepted
open: B249
decided: 2026-11-11
source: grill session 2026-11-11 (night), finding 868 D4
---

# A definite blocker wins over a pending check

ADR 0041 names the build-ready status words but no priority between them. In the B249 live verify, a part with a
definite blocker (for example a hardcoded colour) and a slow check still running showed "Wird geprüft", which hid the
blocker until the slow run ended. As soon as one blocker is definite, the part shows "Nicht baubereit", even while other
checks still run. "Wird geprüft" shows only when no definite blocker exists and a check still runs. The human was asked:
"Soll „Nicht baubereit“ gewinnen, sobald ein sicherer Fehler feststeht?" with the recommendation yes, and answered "ja".
