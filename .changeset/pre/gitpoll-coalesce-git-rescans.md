---
'timetrack-app': patch
---

Timetrack spawns far fewer git processes while idle: a run of commits rescans a repository group once per 20 seconds, and the 10-minute sweep paces itself.
