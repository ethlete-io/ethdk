---
'@ethlete/agent-rules': minor
---

Add `codex-limit.mjs` to the codex-subagent skill: it prints the left share and reset time of the Codex 5h and weekly limit and exits non-zero when exhausted, so agents fall back to a Claude subagent.
