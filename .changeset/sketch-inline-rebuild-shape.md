---
'@ethlete/cli': minor
'@ethlete/agent-rules': patch
---

`design sketch check` now also catches an element a variant draws in an existing part's root class or tag under another prefix (`<span class="tsh-badge">Serie</span>` for `et-badge`) as an inline rebuild, and checks only parts the drawing layer may embed.
