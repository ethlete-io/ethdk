---
"@ethlete/cdk": patch
---

Make every page inside a overlay router outlet a scrollable container on its own. This prevents issues during page transitions. This also removes the need for the `containsOverflowRegion` property being set on a `OverlayRouterOutletComponent` if the page itself is should not be scrollable but some of its children are. Thus, the `containsOverflowRegion` property has been removed. This is not a breaking change, since the property now simply does nothing.
