---
'@ethlete/components': minor
---

`et-select` (and the headless `[etSelect]`) gains an `optionPicked` output and a `pickOnly` input. `optionPicked` emits the picked value whenever a single-select option is committed — a "the user actively picked this" signal distinct from `valueChange`. With `pickOnly`, committing an option emits `optionPicked` without ever writing `value`, so the select stays empty: a fire-and-forget "add" picker that feeds an external list without the set-then-clear dance (and its race with the `[(value)]` write-back). `pickOnly` has no effect in multi-select.
