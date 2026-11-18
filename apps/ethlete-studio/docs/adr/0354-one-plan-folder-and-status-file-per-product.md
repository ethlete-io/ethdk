---
status: accepted
open: B595
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, Timetrack review, its proposal approved by the human with "klingt gut", relayed through the doc agent
---

# One plan folder and one STATUS file per product

The human said (German, verbatim):

> klingt gut. timetrack enttwicklung war eher auf pause da ich mich auf studio fokussiert habe. ich denke auch wir
> sollten es bei 3 sachen lassen. also 3 produkten. studio, timetrack und das sdk an sich. oder was denkst du? ich will
> halt gerne mal ordnung in unsere md files schaffen ind da ein ssystem haben. im moment ist das echt chaos, outdated,
> completed, vergessen und alles dazwischen und auserhalb. deine punkte sind aber natürlich valide

The analysis session proposed the points below; the human answered "klingt gut". The points are the analysis session's
text, approved by the human. They extend ADR 0350-0352 from Studio to all products.

1. One folder per product, same layout: `plans/studio/`, `plans/timetrack/`, `plans/sdk/`, plus `plans/repo/` for
   process and tooling. No loose files in `plans/`.
2. One entry file `STATUS.md` per product: the queue with "next" at the top, then one line per open plan file. Small.
   A session reads it and then the one plan it works on.
3. One place and one end per kind of content: open work is a plan file, done parts deleted (ADR 0350, 0352); a decision
   is an ADR, marked superseded when replaced; a term is CONTEXT.md; an agent rule is AGENTS.md or a skill; a finding
   is a dated findings file, each entry becomes a queue row or is struck, an empty file is deleted; research is a plan
   file, its result becomes an ADR and the file is deleted.
4. A check script in pre-push enforces it: a file under `plans/` linked from no STATUS.md; a file over the size limit;
   a file untouched for N days and not marked parked; a findings entry with no queue row; a reference to a file that no
   longer exists.
5. One-time move: sort each of the about 95 plan files once (open / into an ADR / delete), in slices per product.
   Timetrack first.

Open with the human: the size limits, N, and whether the process ADRs move to a repo-level ADR folder.
