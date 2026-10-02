---
"@ethlete/eslint-plugin": patch
---

`no-inject-chain` no longer reports a constructor called straight off `inject()`, as in `new (inject(Foo).Bar)()`.
