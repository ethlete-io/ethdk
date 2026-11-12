---
'@ethlete/agent-rules': patch
---

The `background-design-commands` hook lets a `--help` or `-h` call of a long `design` command run in the foreground; `studio:e2e --help` stays denied because it runs the suite.
