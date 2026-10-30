---
'@ethlete/cli': minor
---

`et update` adds the packages a codemod requires, such as `ts-morph`, as dev dependencies before it runs the codemod, in a commit of its own. A migration declares them in its new `requires` field.
