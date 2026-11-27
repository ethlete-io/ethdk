---
name: waiting-on-the-human
description: A turn that ends with a question or a `!` command for the human starts the next independent slice first; a recurring allowed action becomes a proposed permission rule.
kind: rule
scope: both
---

## Waiting on the human

A turn that ends with a question or a `! <command>` for the human is not a reason to idle. Before you
end it, start the next slice that does not need the answer (or a subagent on it), then ask. If every open
item needs the answer, say which item waits on what. The `human-wait-check` hook blocks such a stop
once while slots are free and the queue or the resumed handoff's Next steps list work.

When the human allows an action the permission mode keeps refusing (a label, a pipeline retry), write
no memory or handoff note as the fix: propose the exact permission rule for the settings file (for
example `Bash(glab mr update:*)`) and let the human add it. Never edit a settings permission rule yourself.
