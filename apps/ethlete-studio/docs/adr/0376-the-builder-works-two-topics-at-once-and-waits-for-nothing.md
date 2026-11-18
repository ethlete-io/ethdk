---
status: accepted
built: 2f93fdf6f
decided: 2026-11-19
amends: 0230
source: doc-agent session 2026-11-18/19; a fresh builder planned to wait for a CI rerun before its next row
---

# The builder works two topics at once and waits for nothing

A fresh builder held its next row until a CI rerun finished, although the red causes already had their fix on `next`.
The human (German, verbatim): "der builder soll jetzt bitte nicht direkt wieder eine stunde verplämpern mit rumwarten...
dieses ewige gewarte", "gerne einen touch aggresiver", "mir gings dabei eher darum dass er gerne noch ein weiteres
thema paralel bearbeiten darf", and on the summary: "klingt gut. wir wollen das warten schon reduzieren. aber auch
nicht wie noch vor 2 wochen formation wilde wokle fahren und mit 10 subagents die komplette ci rot machen ohne
fortschritt".

1. The builder may work a second topic in parallel, for example two rows in two subagents. Two topics at once is the
   limit; a CI fix does not count against it.
2. The builder waits for nothing: not for a CI run, a subagent, a reply of the doc agent or a review. While something
   runs, it builds.
3. A red CI stops a new feature start only while its cause is unknown and no fix or revert is on `next`. A pushed fix
   or revert does not block; the builder watches the run in the background and returns to it only if it stays red.
   This narrows "a red CI blocks every feature slice" in ADR 0230; the rest of ADR 0230 and ADR 0357 stays.
4. The builder waits only when no queue row can start.

The limit of two in point 1 is the doc agent's reading of "ein weiteres thema" under the human's warning against ten
subagents.
