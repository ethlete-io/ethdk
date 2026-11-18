---
status: accepted
open: B580
decided: 2026-11-18
source: doc-agent session 2026-11-18 (day shift), the private SDK repo (ADR 0342) waiting on access only the human can give
---

# The private SDK switch is prepared before the access arrives

The move of `ethlete-io/ethdk` to private (ADR 0342) waits on access only the human can give: the update host, the
runner group of `runner-ethlete`, HTTPS for Verdaccio with a CI token, and an npm owner for the deprecation. From now
on the builder prepares everything that needs none of it: the CI workflows on the self-hosted runner behind a switch
that stays off, publishing to Verdaccio, and the new updater endpoint in the timetrack-app and ethlete-studio config.
Once the access arrives, only the switch is left. The release that carries the new updater endpoint still ships while
the repo is public. Rejected: starting only once the access is there (the window until the flip grows). The human:
"q1ok" (prepare now, recommended).
