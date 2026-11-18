---
'@ethlete/agent-rules': minor
---

The `background-design-commands` hook also starts a wait loop in the background: a Bash call with an `until` or
`while` loop that sleeps runs with `run_in_background: true`, and the completion notice ends the wait.
