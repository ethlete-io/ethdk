---
'@ethlete/cli': minor
---

`design commit-hunks` now splits every shared JSON under `.ethlete/design` per entry (`--part`, or `--id` for `capabilities.json`), writes keys sorted, refuses files it cannot split, and waits for a held index lock.
