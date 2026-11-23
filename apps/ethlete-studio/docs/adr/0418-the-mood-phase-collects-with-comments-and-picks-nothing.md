---
status: accepted
open: B681
decided: 2026-11-23
source: doc-agent session 2026-11-23, tomflix run 2 mood round
---

# The mood phase collects with comments and picks nothing

Amends ADR 0415, point 1 ("The human picks a mood").

In tomflix run 2 the agent drew the overview page in moods as a sketch on `pages/overview`. The human (German,
verbatim): "irgendwie finde ich es noch immer schwierig da nun eine variante zu picken. irgendwie clasht das. das fühlt
sich an als würde ich damit nun all diese komponenten übernehmen. dabei sind wir gerade eher in eine exploration / mood
board + phase wo wir einfach nur sammeln wollen was cool sein könnte".

Option A accepted ("dann gehen wir erstmal mit A"):

1. In the mood phase the human picks no variant and nothing merges.
2. The human collects by commenting in the mood variants on what he likes, with the comments Studio already has.
3. When the human says he has collected enough, the agent draws the first real page from his comments as a new sketch
   and discards the mood sketch. The mood variants stay in git.

Rejected: a new "like" mark and a mood-board part that keeps every variant (needs three new capabilities and changes
to ADR 0365). It can come later if A does not work.

Cross-check (ADR 0358): asked; verdict "fix" - the first draft bundled several decisions and hid the build cost of B,
so the question was cut to A versus B.
