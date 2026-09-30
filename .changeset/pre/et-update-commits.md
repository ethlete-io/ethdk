---
'@ethlete/cli': minor
---

`et update` commits each step by itself - the version bump, each codemod, the agent rules sync and each finished `--ai` task - and never a file that was dirty before the run; `--no-commit` turns this off.
