---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

An agent session that works in another checkout than the one it was started in - a linked worktree
it `cd`s into, or the files it edits there - is now drawn in that checkout's lane, on that checkout's
own branch, beside the work the first checkout did at the same time. A resync of a checkout re-files
the agent events already stored for it instead of keeping what the older read placed.
