---
'@ethlete/cli': patch
---

`design check` now re-checks each open edit sketch without a decision and closes it as held when every state draws as at HEAD. A direct edit is compared with `record` pictures only when they were drawn at the merged part hash, which new `record` pictures now store as `partHash`; `go` pictures are no longer used for it.
