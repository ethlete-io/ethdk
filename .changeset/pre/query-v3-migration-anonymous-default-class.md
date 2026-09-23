---
'@ethlete/query': patch
---

The v3 migration rewrites a legacy `prepare()` call inside an anonymous `export default class`, instead of leaving it unmigrated behind an unused `Injector` import.
