---
'@ethlete/timetrack': patch
---

`mergeBlocks` no longer draws a band far past the work behind it: a row spans at most twice the time
it observed, and `WorklogProposal.stretches` says where inside a band that time sat.
