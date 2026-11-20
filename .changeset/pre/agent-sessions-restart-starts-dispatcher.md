---
'@ethlete/agent-rules': patch
---

`agent-sessions restart` (also with `--process`) starts the mailbox dispatcher when none runs for the checkout, so a session that was restarted into a repo without one still receives messages.
