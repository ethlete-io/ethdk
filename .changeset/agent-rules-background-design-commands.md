---
'@ethlete/agent-rules': minor
---

Add the `background-design-commands` hook: it denies a Bash call that runs a long design command (`design check`, `compare`, `ready`, `sketch ready`, `harness`, `studio:e2e`, `--visible-change`) without `run_in_background`.
