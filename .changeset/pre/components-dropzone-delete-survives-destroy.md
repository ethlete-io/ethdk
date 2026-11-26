---
'@ethlete/components': patch
---

A dropzone `delete` request no longer gets cancelled when the dropzone is destroyed, so removing a file and navigating away right after still deletes it server-side.
