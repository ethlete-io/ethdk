---
'@ethlete/cli': patch
---

The design check's focus ring probe waits for a busy page to answer instead of failing it after 1 s, so it reports ACTION-FAILED under machine load only for a real defect.
