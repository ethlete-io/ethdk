---
'@ethlete/cli': minor
'@ethlete/agent-rules': patch
---

`et design part remove <layer>/<name>` deletes a merged part with its `merged.json` entry and tsconfig path, and resolves its comments. It refuses a part another part imports, a base part, and a part with an open sketch.
