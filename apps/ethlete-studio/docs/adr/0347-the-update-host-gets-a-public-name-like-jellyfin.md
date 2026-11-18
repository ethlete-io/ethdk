---
status: accepted
open: B580
decided: 2026-11-18
source: doc-agent session 2026-11-18 (day shift), public reach of the elrond update host (ADR 0345, ADR 0346)
---

# The update host gets a public name like Jellyfin

The planned update base `https://updates.local.elros.cc:12345` had no public DNS record, so an installed app outside
the LAN could never reach it. The other services behind elrond's `extern` entrypoint already solve this: for example
`jellyfin.local.elros.cc` is a public CNAME to the home DynDNS name. Decided by the human: the update host is
published the same way, as a public CNAME `updates.local.elros.cc` to the same DynDNS name, behind Traefik's
`extern` entrypoint on port 12345. Rejected: hosting the update files elsewhere (for example on the Verdaccio server).

The human: "q1 machwn wir wie jellyfin und co".
