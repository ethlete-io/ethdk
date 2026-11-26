---
'@ethlete/agent-rules': patch
---

`restart` logs why it waits (`restart.log` next to the mailbox) and gives up 60 s after the clear: it tells the pane via tmux and saves the prompt to `restart.prompt.<session>.txt` instead of waiting silently.
