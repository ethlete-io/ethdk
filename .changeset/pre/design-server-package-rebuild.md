---
'@ethlete/cli': patch
---

The design server draws a rebuilt `render.packages` folder (such as `dist/libs/components`) without a restart, instead of serving the modules it loaded before the rebuild.
