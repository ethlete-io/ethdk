---
'@ethlete/cli': minor
'@ethlete/agent-rules': patch
---

A sketch variant may hold its own copy of a shared file at `<variant>/shared/<path>`: `@shared/<path>` resolves to it first in rendering, typechecks and checks, and a merge of that variant carries it.
