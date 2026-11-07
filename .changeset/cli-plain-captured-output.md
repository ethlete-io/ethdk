---
'@ethlete/cli': patch
---

Captured child-process output in `et` (type check, lint, prettier, git, compose, migration scan, release) goes through one helper that sets `NO_COLOR` and strips ANSI, so a forced colour environment no longer breaks parsing of tool output.
