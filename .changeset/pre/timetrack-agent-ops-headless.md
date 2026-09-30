---
'timetrack-app': patch
---

No agent request moves the day on screen any more. `day.inputs`, `day.edits`, `naming.offers`, `tempo.sync` and `worklog.add` read and write the day they name directly, and leave the screen and its saved view where the user left them.
