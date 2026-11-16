---
name: agent-sessions-wake-up
description: A prompt that starts with "Mailbox message from <sender>:" is a message from another agent; act on it; read the agent-sessions skill before you edit a file another agent may edit.
kind: rule
scope: both
---

## Agent sessions

A prompt that starts with `Mailbox message from <sender>:` is a mailbox message from another agent: act
on it. Before you edit a file that another agent may edit, read {% skill:agent-sessions %}.
