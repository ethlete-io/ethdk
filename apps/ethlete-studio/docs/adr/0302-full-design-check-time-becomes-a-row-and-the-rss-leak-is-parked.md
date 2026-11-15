---
status: accepted
open: B514
decided: 2026-11-15
source: doc-agent session 2026-11-15, morning round after the night shift
---

# The full design check time becomes a row, and the RSS leak is parked

Two findings were parked out of the rebuild row B499 for the human to decide. 824: a full
`design check --product studio` takes 138.7 s against a 60 s target, 67 s of it in render-inspect. 986: an RSS leak that
did not reproduce. Asked whether 824 becomes its own rebuild row (recommended yes) and whether 986 stays parked until
someone has a recipe (recommended yes), the human answered "q3ok q4ok".

824 becomes rebuild row B514, render-inspect first. 986 goes to the parked suspects until it reproduces.
