---
'@ethlete/agent-rules': patch
---

When the checkout has `tools/scripts/own-scope-preload.mjs`, `agent-sessions` registers it through `NODE_OPTIONS` for the agent, so each nx, vitest and tsc run the agent starts leaves the avoided agent scope.
