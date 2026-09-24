---
'timetrack-app': patch
'@ethlete/timetrack': patch
---

Timetrack now records a second, one-minute input-idle signal on Wayland: only that input stopped or
returned, never which key or what content. `promptOriginAt` reads it to tell a prompt typed at the desk
from one sent from a phone. Breaks and rows do not use it yet.
