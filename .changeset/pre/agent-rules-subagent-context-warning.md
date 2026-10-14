---
'@ethlete/agent-rules': patch
---

The context-warning hook now warns a Claude sub-agent from its own transcript and, at the critical tier, makes it commit and hand back its remaining steps instead of growing past the budget.
