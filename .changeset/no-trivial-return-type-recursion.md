---
'@ethlete/eslint-plugin': patch
---

`no-trivial-return-type`: self-referencing (recursive) functions keep their return type annotation — TypeScript cannot infer a return type that depends on itself (TS7023), so the fixer no longer strips it there.
