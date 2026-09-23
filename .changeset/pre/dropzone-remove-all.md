---
'@ethlete/components': minor
---

Add `removeAll()` to `etDropzone`: it removes every entry like `removeEntry`, including the configured `delete` request per persisted value. `clear()` stays a local reset that never deletes on the server.
