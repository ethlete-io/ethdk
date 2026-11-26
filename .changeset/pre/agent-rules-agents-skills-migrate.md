---
'@ethlete/agent-rules': minor
---

- Skills now compile to the cross-tool `.agents/skills/ethlete-*/SKILL.md` format, discovered natively by Codex, Cursor and Copilot; the `.agents/ethlete/` pointer tree is pruned on sync.
- New `ethlete-agents migrate` converts a repo to the `AGENTS.md`-canonical layout: `CLAUDE.md` becomes an `@AGENTS.md` import and hand-written skills move to `.agents/skills` with symlinks.
- New opt-in `hooks` config: `context-warning` warns (and instructs Claude) before the context crosses the 200k long-context pricing boundary, recommending `/handoff`.
- A gitignored `ethlete-agents.config.local.json` (`"disableHooks": true` or a list of hook names) disables generated hooks per machine at runtime — committed files never change, and `sync`/`check` warn about unsupported keys or unknown hook names in it.
