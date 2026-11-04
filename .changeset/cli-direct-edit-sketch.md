---
'@ethlete/cli': minor
---

A merged design part edited outside a sketch is now a `direct-edit` open point. `design check` and the design server
draw it: when every state draws as before, the edit holds at once; when a state draws differently, they open a ready
`<part>@edit` sketch with the variants `old` (the design at HEAD) and `new` (the edit) to pick in Studio. Auto-merges and
`sketch merge --allowed-by` / `--note` no longer write `accepted.json`; the plan ref and reason go into the part's
`merged.json` entry as `note`. `pictures.json` stores one picture kind, `record`, at the part's design hash; the older
`review` and `go` kinds are still read.
