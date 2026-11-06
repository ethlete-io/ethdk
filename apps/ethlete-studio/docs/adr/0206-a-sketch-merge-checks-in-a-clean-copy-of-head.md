---
status: accepted
open: B406
decided: 2026-11-06
source: grill session 2026-11-06
---

# A sketch merge checks in a clean copy of HEAD

Tom's merge of `components/title-bar@notice-hint` was refused a third time (findings 434, 468) by the dirty guard in
`merge.ts`: other sessions' uncommitted files under `.ethlete/design` (a builder's `rule-baseline.json`, a ready mark
with no known writer). The process rule "no agent edits product files while a sketch waits for Tom" did not hold. The
merge now runs its check in a clean copy of HEAD plus only the merged sketch, so foreign uncommitted edits can neither
block it nor fail its check. Only the merge result is then written into the real tree; if it touches a file that is
dirty there, the merge names exactly that file. Tom: "q1ok" (option a, recommended).
