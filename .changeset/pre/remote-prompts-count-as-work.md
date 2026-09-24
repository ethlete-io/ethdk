---
'timetrack-app': patch
'@ethlete/timetrack': patch
---

Inside a break, the time from the first prompt sent from another device to the last is now drawn as
work rather than break, and what is left either side stays a break only if it is long enough. Each such
prompt books its 15-minute allowance of that stretch, at most an hour a day, earliest first; the rest
is drawn but not booked. A prompt
counts as remote only when the app watched the seat through it; days without the input signal do not
change.
