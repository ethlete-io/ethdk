---
'@ethlete/agent-rules': patch
---

The `nx-layout` rule now makes one domain lib per app (`libs/domain/<app>`, a folder per feature) the default. A feature gets its own lib only for a concrete reason, such as size or build time.
