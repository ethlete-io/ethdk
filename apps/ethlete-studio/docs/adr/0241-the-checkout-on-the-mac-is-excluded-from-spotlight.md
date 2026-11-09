---
status: accepted
built: 348dadeb0
decided: 2026-11-09
source: grill session 2026-11-09 (Mac night shift, morning round)
---

# The checkout on the Mac is excluded from Spotlight

During the e2e measurement on the Mac, `mds_stores` and `mediaanalysisd` ran at about 140 % CPU, which slows and
destabilises the measured runs. The human adds `~/dev/ethlete-sdk` to the Spotlight privacy list in System Settings; an
agent cannot change it. The human: "Q2ok".
