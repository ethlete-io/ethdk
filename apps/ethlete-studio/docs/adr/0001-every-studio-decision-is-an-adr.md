---
status: accepted
open: none
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Decision records and plan size" (finding 385) item 1
---

# Every Studio decision is an ADR

Studio decisions sat in 25 of 57 plan files (134 decision blocks), and a decided focus view (render-checks.md
4.48) was asked again and half built. Tom: "daran erkennt man dass unser plan system offensichtlich nicht gut
funktioniert ... das doc ist ja auch mittlerweile meterlang". So every Studio decision, small ones too, becomes one
ADR here with its build state in the frontmatter (`built: <sha>` or `open: B<row>`), deviating on purpose from the
`ethlete-domain-modeling` rule that only hard-to-reverse decisions get an ADR. New decisions go only here, never
again into decisions-latest.md or a finding; the old place keeps a link.
