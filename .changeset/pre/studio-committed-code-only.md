---
'@ethlete/cli': patch
'ethlete-studio': patch
---

Studio starts its design server from a CLI copy built from the last `libs/cli` commit and no longer restarts it on a rebuild; `yarn et:design` runs design commands from that copy.
