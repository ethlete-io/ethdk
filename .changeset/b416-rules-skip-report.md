---
'@ethlete/cli': patch
---

`design check --rules` prints one line per rule it skipped, with the reason. Under `CI`, a rule skipped for a missing input, such as no `--base`, fails the check; a rule that does not apply stays a note.
