---
'timetrack-app': patch
---

The Timetrack host lets a forge `api` call read a request body only from stdin and refuses a `-F`/`--field` value that names a local file.
