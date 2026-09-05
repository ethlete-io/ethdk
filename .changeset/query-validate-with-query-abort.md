---
'@ethlete/query': patch
---

`validateWithQuery` now stops the in-flight validate request when the field goes idle - a closed `when` gate or a failing synchronous validator - instead of leaving it running.
