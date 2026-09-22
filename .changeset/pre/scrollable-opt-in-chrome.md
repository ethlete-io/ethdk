---
'@ethlete/components': major
---

Scrollable: the buttons, dots, drag and snap are now opt-in directives on the `<et-scrollable>` itself, so a plain track no longer bundles them. Replace `renderButtons` / `buttonPosition` / `stickyButtons` with `[etScrollableButtons]` (`SCROLLABLE_NAVIGATION_IMPORTS`), `renderNavigation` with `etScrollableNavigation`, `snap` / `snapOrigin` / `cursorDragScroll` with `etScrollableSnap` / `etScrollableDrag` (`SCROLLABLE_DRAG_IMPORTS`), and `darkenNonIntersectingItems` with `etScrollableDarken` (`SCROLLABLE_DARKEN_IMPORTS`). `ScrollableMasksDirective` / `ScrollableButtonsDirective` / `ScrollableNavigationDirective` are renamed to `…Component`; the directive names now belong to the opt-ins.
