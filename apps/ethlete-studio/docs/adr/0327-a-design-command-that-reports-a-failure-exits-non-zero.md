---
status: accepted
built: 662850c50
decided: 2026-11-17
source: doc-agent session 2026-11-17 morning round, second sighting of a failure line with exit 0
---

# A design command that reports a failure exits non-zero

`design compare` printed 16 "FAILED" lines and `sketch check` printed "could not render", and both exited 0, so an
agent or CI reads the run as green. Asked whether this becomes a new rebuild group, with the recommendation that every
FAILED or could-not-render line goes through one shared output path that sets the exit code, the human said "ok".

New rebuild group: a failure line in a design command is written only through one shared path, and that path sets a
non-zero exit code. A command cannot print a failure and exit 0.
