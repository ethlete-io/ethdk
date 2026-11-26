---
'@ethlete/eslint-plugin': minor
---

New rule `no-legacy-prepare-without-injector`: a legacy query `prepare()` called from a deferred callback
must pass an `injector`, with a fixer that adds the member and threads it.
