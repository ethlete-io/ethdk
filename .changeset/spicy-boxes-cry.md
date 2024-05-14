---
"@ethlete/cdk": patch
---

Fix transitions between navigation dots inside carousel component. Before, the exiting dot would not animate out properly resulting in a layout shift. Now, the exiting dot will animate out properly at the same time as the entering dot animates in.
