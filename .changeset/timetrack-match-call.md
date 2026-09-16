---
'@ethlete/timetrack': patch
---

`matchTicketWithAgent$` asks the agent only what already tracks a stretch of work: the parent and an
open issue that may be it. It writes no summary and no description.
