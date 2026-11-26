---
'timetrack-app': patch
---

Return the heap a large batch of events left behind to the OS on Linux, so the app no longer keeps its largest IPC body resident for good.
