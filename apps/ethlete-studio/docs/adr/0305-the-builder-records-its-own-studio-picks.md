---
status: accepted
built: eb3519bd5
decided: 2026-11-15
source: doc-agent session 2026-11-15, evening, Q1 of the open round
---

# The builder records its own Studio picks

The human decided in the morning of 2026-11-15 that the builder picks its own recommended variant. Claude Code auto
mode then denied `yarn design sketch pick` to the builder as undermining oversight, and six picks stayed blocked:
title-bar@uncommitted, components/action-sheet@look, pages/system@canvas-note, shell-main@crashed,
title-bar@notice-arrow and empty-state@row-layout. Asked whether a project permission rule should allow exactly that
command, or whether the human clicks the picks in Studio, with the recommendation of the rule, the human answered "a".

`.claude/settings.json` allows `Bash(yarn design sketch pick *)`, and only that command. The builder then records the
pick of its recommendation itself. The human sets the rule: auto mode denied the doc agent the settings edit too.

As built: the builder's `yarn et:design sketch pick` ran without a denial, so the settings rule was never added and is
not needed while that holds.
