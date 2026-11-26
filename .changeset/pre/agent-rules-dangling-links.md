---
'@ethlete/agent-rules': patch
---

Render a `{% skill:… %}` cross-reference as a bare name when the guide it points at was
filtered out of the target repo, instead of emitting a path to a file that was never
written. `sync` now reports each such reference.
