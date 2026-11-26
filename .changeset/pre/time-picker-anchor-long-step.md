---
'@ethlete/components': patch
---

`et-time-picker`: An empty ring now starts the keyboard on a ring stop when `minuteStep` does not divide an hour, so with a step of 90 the first arrow press from 10:07 lands on 10:30 instead of 12:00.
