---
'@ethlete/cli': patch
---

`et design sketch check` no longer moves a ready sketch back to in progress; it prints `READY-STALE` instead, and the ready content hash ignores the generated editor `tsconfig.json`.
