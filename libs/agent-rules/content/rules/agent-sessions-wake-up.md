---
name: agent-sessions-wake-up
description: A prompt that says "New mailbox message for <name>" means run the inbox command in it and act on the result; read the agent-sessions skill before you edit a file another agent may edit.
kind: rule
scope: both
---

## Agent sessions

If a prompt says `New mailbox message for <name>`, run the `inbox` command in that prompt and act on
the messages. Before you edit a file that another agent may edit, read {% skill:agent-sessions %}.
