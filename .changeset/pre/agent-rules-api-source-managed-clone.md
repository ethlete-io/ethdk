---
'@ethlete/agent-rules': patch
---

The `api-source` skill now finds the managed clone in `.ethlete/<name>` when `apiRepoPaths` has no entry, and reads the checkout and the local url from `yarn et api help <name>`.
