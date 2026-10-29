# agent-rules

`libs/agent-rules` publishes `@ethlete/agent-rules`: the portable slice of this repo's
guidance, compiled into Claude Code, Codex, Cursor and Copilot formats. Content lives in
`libs/agent-rules/content/`; what this repo itself consumes is configured in
`ethlete-agents.config.json` (`profile: sdk`, so only `scope: both` content is emitted
here). Never hand-edit the generated marker block at the end of the root `AGENTS.md` or a generated
`ethlete-*` skill - edit the content file in `libs/agent-rules/content/`, then:

```bash
npx prettier --write libs/agent-rules/content/<file>   # format first
yarn agents:sync                                       # then regenerate
```

A few content files are vendored from another repository. Keep them as written upstream,
apart from the generator's link syntax - `libs/agent-rules/THIRD-PARTY-LICENSES.md` names
each one, its upstream commit and its license.

`content/output-styles/` is the exception: a Claude Code output style is a machine-level
file, so `sync` never emits it and `agents:check` never diffs it. It is installed on
demand instead - `node dist/libs/agent-rules/src/index.js output-style` after a build here,
`npx ethlete-agents output-style` in a consumer repo.

Format **before** syncing. The generated copies under `.claude/` and `.agents/` are
Prettier-ignored, so formatting the content afterwards silently leaves them stale, and
`yarn agents:check` (which CI runs) fails. The `npx ethlete-agents sync` in the published
README works in consumer repos only - here the package is the source, not a dependency,
so `npx` would look it up on the registry and 404.
