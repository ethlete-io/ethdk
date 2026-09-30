---
'timetrack-app': patch
---

`timetrack rows` and `timetrack snapshot` read a day without moving the day on screen, so several requests at once no longer race and time out.
