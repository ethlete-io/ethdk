---
'@ethlete/cli': patch
---

A design check that waits for another process's Tailwind run reads its answer instead of running Tailwind again when that run ends between the cache read and the lock.
