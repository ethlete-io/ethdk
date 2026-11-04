---
status: accepted
built: 4c1667672
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "CLI copy build at restart" (finding 372)
---

# The restart click approves building a new CLI copy

When a newer `libs/cli` commit has no copy yet, "Neu starten" builds it on its own (`tools/scripts/studio-code.mjs`,
about 1-2 min in a temp worktree), from committed code only. The rule "Tom approves each CLI build" applies only to
builds an agent starts by hand.
