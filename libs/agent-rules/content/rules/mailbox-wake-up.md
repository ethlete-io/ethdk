---
name: mailbox-wake-up
description: A prompt that says "New mailbox message for <name>" means run the inbox command in it and act on the result; read the mailbox skill before you edit a file another agent may edit.
kind: rule
scope: both
---

## Agent mailbox

If a prompt says `New mailbox message for <name>`, run the `inbox` command in that prompt and act on
the messages. Before you edit a file that another agent may edit, read {% skill:agent-mailbox %}.
