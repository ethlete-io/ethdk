---
'@ethlete/core': minor
---

Title parts keep the place they got when they were bound, so a part that empties and comes back no longer moves to the end. The new `order: 'child-first'` option of `provideTitleConfig` builds `Child | Parent | Suffix`.
