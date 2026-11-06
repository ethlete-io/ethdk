---
status: accepted
open: B416
decided: 2026-11-06
source: doc-agent session 2026-11-06
---

# `next` is pushed once the full check meets its target

ADR 0213 parked the push of `next` during the performance block; by now 238 commits wait, among them the SDK fixes the
fifagg update needs (section 12 of `plans/et-update-findings.md`). The builder pushes `next` once the full
`design check --product studio` meets its 60 s target (end of S7), after a local CI run (`ci-check` skill) is green. If
fifagg needs the fixes before that, the push happens at once, with the same green local CI first. Rejected: pushing now
(the performance slices still change the CLI daily) and waiting for the end of the whole performance block (the batch
grows and a CI failure gets harder to tie to a commit). Tom: "q1ok" (option b, recommended).
