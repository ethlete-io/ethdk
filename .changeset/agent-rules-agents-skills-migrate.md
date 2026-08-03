---
'@ethlete/agent-rules': minor
---

Skills now compile to the cross-tool `.agents/skills/ethlete-*/SKILL.md` format, which Codex, Cursor and Copilot discover natively; the `.agents/ethlete/` pointer tree is gone and pruned on the next sync. New `ethlete-agents migrate` command converts a repo to the `AGENTS.md`-canonical layout: `CLAUDE.md` becomes an `@AGENTS.md` import and hand-written `.claude/skills` move to `.agents/skills` with symlinks left behind.
