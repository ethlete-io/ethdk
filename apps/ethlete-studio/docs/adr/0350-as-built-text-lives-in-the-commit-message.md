---
status: accepted
open: B582
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, its proposal approved by the human with "ok" ("1, 2 und 4 sofort, 3 und 5 danach" was the proposal), relayed through the doc agent
---

# The as-built text lives in the commit message, and STATUS.md is not committed per row

STATUS.md was in 433 commits and design-to-code.md in 522 in eight days. From now on the "as built" text of a slice
lives only in its commit message, with no as-built section in a plan file. A finished row is not committed to STATUS.md
one by one: the doc agent folds closed rows in with its hourly commit (ADR 0284). This changes ADR 0284 where it lets
the builder delete its row in the slice commit.
