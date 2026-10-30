---
'@ethlete/cli': patch
'@ethlete/agent-rules': patch
---

A multi-target sketch merge gives each target only the `shared/` files it imports, directly or transitively; an unimported file returns to the target that held it. `sketch new` refuses targets whose `shared/` files clash.
