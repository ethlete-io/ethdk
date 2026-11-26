---
'@ethlete/components': patch
---

Scrollable: the edge masks and the previous/next buttons now actually appear. Their
base `opacity: 0` was declared outside `@layer components`, so it beat the layered
rules that reveal them regardless of specificity.
