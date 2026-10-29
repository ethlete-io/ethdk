---
'@ethlete/cli': patch
---

The `CLIPPED` render check measures a scaled `embedPage` at its scaled size, so a page that embeds a scaled page no longer needs `checks: { skip: ['CLIPPED'] }`.
