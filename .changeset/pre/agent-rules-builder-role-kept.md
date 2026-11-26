---
'@ethlete/agent-rules': patch
---

The builder Stop hook now blocks a turn that ends with more than one line of chat text. `restart --process` keeps the session's role. Resuming a role handoff loads its role skill.
