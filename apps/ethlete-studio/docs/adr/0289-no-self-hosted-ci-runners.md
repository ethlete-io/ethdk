---
status: accepted
built: ce1eb19f3
decided: 2026-11-12
source: decision of the human, about 15:10 local, relayed by the analysis session (claude2); supersedes point 5 of ADR 0286
---

# No self-hosted CI runners

The repo `ethlete-io/ethdk` is public. A self-hosted runner on a public repo can run the code of a fork pull request
on that machine. The builder asked the question that ADR 0286 point 5 asked for, and recommended no self-hosted
runners. The human answered (German, verbatim):

> Ne eigene Runner machen wir auf keinen Fall.

The Mac and the Windows PC do not become CI runners. B507 ships without point 5 of ADR 0286. No later row for runners.
