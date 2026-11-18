---
'@ethlete/agent-rules': minor
---

The `background-design-commands` hook no longer denies a long design command run in the foreground: it starts it with
`run_in_background: true` and says so in a note.
