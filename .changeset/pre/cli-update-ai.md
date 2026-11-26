---
'@ethlete/cli': patch
---

`et update --ai` stops before any change when `updateAgentCommand` is missing, hands the agent a real prompt, reports each task, and works on the tasks an earlier run left.
