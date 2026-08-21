---
'@ethlete/cli': patch
---

A failing `et api` exec command no longer always blames a private dependency. That hint is kept for a command that installs dependencies; any other one suggests running the install command first.
