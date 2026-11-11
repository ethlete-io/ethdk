---
status: accepted
built: 48290d954
decided: 2026-11-09
source: grill session 2026-11-09
---

# The slowest wait in the builder loop is measured and fixed first

The human: "ich denke auch das größte issue ist nach wie vor das lange warten". The wall-clock time of the builder loop
(edit, checks, commit, push) is measured from the session transcripts and logs, not guessed. The step that costs the
most waiting becomes item 1 of the binding order (ADR 0234), with a clear end; then the Studio list goes on. The human:
"q2ok" (option a, recommended).
