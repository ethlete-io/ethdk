---
'@ethlete/cdk': patch
---

Lower css specificity on component host element styles so they can be overridden using tailwind classes without the need for `!important`.
This applies to the following components:
 - skeleton
 - scrollable
 - scrollable-placeholder