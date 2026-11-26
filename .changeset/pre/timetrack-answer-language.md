---
'@ethlete/timetrack': patch
---

`ReasoningOptions` takes a `language`, which `agentProcessSpec` appends to every system prompt it
builds. `reasoningOptionsOf` reads it off a settings document, so one option reaches all four calls.
