---
open: B616
decided: 2026-11-19
---

# The Mac runs Timetrack from the repo while B602 and B616 are open

On 19.11. the Mac showed agent night work from 00:15 to 03:15 as the human's attended time ("Worked on the Mac's host",
ET-772, 3h), although the human was not there. The Mac ran the release 0.2.0-next.19, which
holds none of the B602 night commits. The human offered: "ich kann timetrack da sonst auch beenden und serven stattdessen
dann musst du nur ab und an dort im sdk pullen", and agreed with "ok" when this was recommended.

Until the day description (B602) and the coupled computers (B616) are closed, the Mac runs Timetrack from the SDK
checkout (`yarn timetrack`) instead of a release. The builder pulls `next` on the Mac over ssh after each push that
changes Timetrack, and restarts it. After both rows close, the Mac goes back to a release build.
