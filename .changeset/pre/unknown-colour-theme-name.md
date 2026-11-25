---
'@ethlete/cli': patch
'@ethlete/agent-rules': patch
---

`sketch check` warns when a state uses an `et-color--<name>` class that no foundation of the product defines, and names the defined ones, instead of letting it fall back to the accent silently.
