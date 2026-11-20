---
'@ethlete/cli': patch
'ethlete-studio': patch
---

Studio lists a `plan-question` open point (an ADR naming the part that is decided but not built) with the comments, and takes its open-point type from the CLI, so a new open-point kind fails Studio's build instead of being dropped.
