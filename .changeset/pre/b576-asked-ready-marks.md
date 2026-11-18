---
'@ethlete/cli': patch
---

`design check --part` writes only the ready marks of the asked parts into `ready.json`, and never the design server's cached marks; `design ready` commits only its own mark and leaves every other entry uncommitted in the working file.
