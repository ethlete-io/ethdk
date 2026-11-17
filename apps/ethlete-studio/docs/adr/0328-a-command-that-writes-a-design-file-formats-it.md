---
status: accepted
built: 9824a12e2
decided: 2026-11-17
source: doc-agent session 2026-11-17 morning round, second unformatted ready.json from sketch merge
---

# A command that writes a design file formats it

`sketch merge` committed `.ethlete/design/studio/ready.json` unformatted twice (fixed by hand in 317f72e44 and
ef6200367), and the pre-push format check refused the push. Asked whether this becomes a new rebuild group, with the
recommendation that the writer formats, the human said "ok".

New rebuild group: every design command that writes a file under `.ethlete/design` writes it formatted, so no format
fix-up commit follows it.
