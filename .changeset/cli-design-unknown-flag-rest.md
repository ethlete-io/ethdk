---
'@ethlete/cli': patch
---

`design product`, `new`, `system` and every `sketch` command refuse an unknown flag with exit code 2 and list only their own flags. `commit-hunks` exits 2 on bad usage.
