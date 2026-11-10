---
'@ethlete/agent-rules': patch
---

The builder Stop hook now counts the final message of the turn from `last_assistant_message`. Claude Code calls the hook before that message reaches the transcript.
