---
status: accepted
open: B592
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, Package D, its proposal approved by the human with "klingt gut", relayed through the doc agent
---

# A plan file holds only open things

The human said (German, verbatim):

> wir müssen dann aber auch echt mal was gegen diese ständig mega wachsenden md files machen. die helfen so niemandem
> und verbennen tokens wie sonstwas.

The analysis session proposed the three points below; the human answered "klingt gut". The points are the analysis
session's text, approved by the human.

1. A plan file holds only open things. Closing a row deletes it; history is git.
2. After the cleanup, lower the budgets in `tools/scripts/size-budget.json`: STATUS.md from 100000 to about 30000
   chars; design-to-code.md (budget 440000) goes to `archive/` as a whole, because it is a finding log and ADR 0280
   ended finding numbers. The existing pre-commit size check then refuses growth; no new mechanism. The exact numbers
   come from the files after the cleanup, with little headroom.
3. One command prints only the open queue (what the builder takes next), so no session greps STATUS.md for it
   (B593).
