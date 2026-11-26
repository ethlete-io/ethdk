---
'@ethlete/agent-rules': patch
---

`init` and the default commands now follow the repo's package manager (yarn, pnpm, bun) and detect Claude from a `CLAUDE.md`. The generated banners name that runner, and `sync` only warns about a missing lint script when emitted content uses it.
