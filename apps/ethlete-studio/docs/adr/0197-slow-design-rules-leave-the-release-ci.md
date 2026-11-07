---
status: accepted
open: B396
governs: ['.github/workflows/*']
decided: 2026-11-05
source: grill session 2026-11-05
---

# The slow design rules leave the release CI

The CI step "Slow design rules against the pull request base" (`design check --product studio --slow`) ran more than
11 minutes on every `next` push, SDK-only pushes too, and a release waited for it (finding 473). Tom: "das ist keine
lösung für die ci. das ist viel zu langsam".

The `--slow` compare moves into its own workflow. It runs only when `apps/ethlete-studio`, `.ethlete/design/studio` or
`libs/cli` change, and it does not block `CI (Next)` or a release. The static design rules stay in `CI (Next)`. Every
CI step gets a time budget that fails loudly when crossed. Sharding alone was rejected: it keeps the release waiting
on Studio. Tom: "q1ok".
