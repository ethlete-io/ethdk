---
'@ethlete/cli': patch
---

`et design --request-log <file>` (or `DE_REQUEST_LOG`) appends one JSON line per finished request: start, method, url, status, ms, bytes and the requests open at its start.
