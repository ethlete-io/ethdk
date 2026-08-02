---
'@ethlete/agent-rules': minor
---

Add `@ethlete/agent-rules`: the portable Ethlete coding guidance - styleguide, Angular
patterns, signals vs RxJS, theming, query, commits, Storybook verification - packaged
for consumer repos and compiled into Claude Code, Codex (`AGENTS.md`), Cursor and
Copilot formats from one canonical source. `npx ethlete-agents sync` writes the
generated files, `check` fails CI on drift, and `init` scaffolds the config. Content is
filtered per repo by installed packages (`requires`), profile (`scope`) and configured
template variables.
