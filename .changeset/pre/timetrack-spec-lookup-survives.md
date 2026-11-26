---
'@ethlete/timetrack': patch
---

`specForCommits$` answers null when the host call throws, rather than ending the stream.
`shasFromEvidence` takes evidence instead of details, and reads a sha off commit evidence only.
