---
'@ethlete/query': patch
---

Persistent auth: a session now survives a page reload when `localStorage` refuses writes or is unavailable, instead of silently logging the user out.
