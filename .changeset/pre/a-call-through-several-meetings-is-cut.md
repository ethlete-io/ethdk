---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

A call that runs through several accepted meetings is cut at their boundaries, and each piece is named
from the meeting it overlaps. Call time outside every meeting stays its own unnamed band, and a call
over a single meeting stays whole.
