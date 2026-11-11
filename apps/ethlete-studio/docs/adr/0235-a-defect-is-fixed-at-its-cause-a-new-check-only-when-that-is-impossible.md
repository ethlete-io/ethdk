---
status: accepted
built: 48290d954
decided: 2026-11-09
source: grill session 2026-11-09, findings 623-638
---

# A defect is fixed at its cause, a new check only when that is impossible

One off-centre badge (finding 623) grew into a detector rule with 264 hits, a baseline, six SDK sketches, a blocked
accept and a new commit check. The human: "wir sind gefangen in einer fehler loop" and "wenn wir die fehler ignorieren
oder monkey patchen kommen sie wieder". Every defect is still fixed at its cause, never patched or ignored. The tool fix
first asks whether a building block, a type or a default can make the defect impossible (for example an SDK pill that
centres icon and text by construction). Only when that is not possible does a new detector rule come. The human:
"q1ok" (option a, recommended).
