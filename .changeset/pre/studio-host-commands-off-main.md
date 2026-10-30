---
'ethlete-studio': patch
---

The host reads projects, git state and folder scans off the main thread, a scan skips `node_modules`, and a call check gives up after two minutes.
