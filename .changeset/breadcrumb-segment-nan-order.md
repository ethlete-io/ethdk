---
'@ethlete/components': patch
---

`etBreadcrumbSegment` treats an `order` that is not a number (an empty attribute, a typo) as unset, instead of sorting the trail unpredictably.
