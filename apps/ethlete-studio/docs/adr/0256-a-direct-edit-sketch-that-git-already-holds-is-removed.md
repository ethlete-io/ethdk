---
status: accepted
open: B483
decided: 2026-11-10
source: grill session 2026-11-10 (evening), finding 729
---

# A direct-edit sketch that git already holds is removed

When HEAD already holds the change of an open `<part>@edit` sketch, the tool deletes that sketch by itself, with no pick
and no notice to the human. Studio never shows such a sketch, and it never blocks the part from being build-ready. The
human, on the stale `components/title-bar@edit` sketch: "wieso ist der sketch denn noch da? new wählen sollte hier nicht
die lösung sein. die lösung sollte sein das dieser sketch dann nicht existiert." Then "q1ok" to the summary.
