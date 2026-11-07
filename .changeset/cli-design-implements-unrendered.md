---
'@ethlete/cli': patch
---

`et design check --slow` reports `IMPLEMENTS-UNRENDERED` when a live page's design embeds a part whose `implements` component the app does not render where the design draws that part. Before, a part could stay linked to a component the app no longer uses there.
