---
'@ethlete/cli': patch
---

The stale cli build refusal now also compares the source hash when `dist/libs/cli` is symlinked from outside the checkout: a matching build runs, a build from other sources is refused.
