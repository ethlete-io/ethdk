---
'@ethlete/components': minor
---

Floating action: new `etFloatingAction` family — a trigger that pins itself to the viewport corner once its place
in the page scrolls away, and stands down once the region it acts on is gone. Replaces cdk's `rich-filter`, which
rendered no filter UI; the three states are published as one `data-state`.
