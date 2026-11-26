---
'@ethlete/agent-rules': minor
---

Add the opt-in `design-live-check` hook: after each write of a design file it runs `et design lint` on it and hands every finding back to the agent.
