---
'@ethlete/timetrack': minor
---

A Tempo `metadata.next` cursor is now followed only on Tempo's own HTTPS origin. Any other URL
raises `TempoCursorError` instead of sending the Tempo token there.
