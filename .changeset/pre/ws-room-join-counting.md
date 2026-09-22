---
'@ethlete/query': patch
---

Web socket rooms: joins are counted, so one subscriber unmounting no longer leaves a room the others still hold - they used to silently stop receiving messages.
