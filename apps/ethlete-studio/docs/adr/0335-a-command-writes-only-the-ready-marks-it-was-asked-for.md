---
status: accepted
open: B576
decided: 2026-11-17
source: doc-agent session 2026-11-17 (late evening), the human on the ready marks family
---

# A command writes only the ready marks it was asked for

`design check` and `design ready` wrote or dropped ready marks of parts nobody asked for (five sightings on 2026-11-17,
last 4677112b7), and one part's ready mark made the next embedded part's mark read stale (13 of 17 pages/system
blockers were stale marks only). No rebuild group owned it; a new group is the human's decision. The doc agent
recommended a group; the human answered "ok".

- New rebuild group B576: a command writes only the marks of the parts it was asked for.
- A ready mark keys on what the part uses, not on a whole shared file.
- The parked lines "design ready whole file", "stale ready marks cascade" and "ready passes where check fails" join it.
