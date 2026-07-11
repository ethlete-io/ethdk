---
'@ethlete/components': minor
---

Grid & Tabs: the previously allocated error codes are now actually enforced, and a nav-tabs composition bug is fixed.

- Tabs (dev mode): `ET2000` when a tab trigger has no enclosing tab bar, `ET2001` when `<et-tab>` / `etTabPanel` sit outside a tab group (an orphan `<et-tab>` used to disappear silently), `ET2002` when a headless tab group has triggers but no panels, `ET2003` when nav-tab pieces are used without `et-nav-tabs`.
- Grid (dev mode): `ET1900` for items outside a grid, `ET1901` for drag/resize handles outside a grid item, `ET1902` for duplicate item ids, `ET1903` when `restoreState()` receives unknown breakpoint names, and the new `GRID_ERROR_CODES.UNKNOWN_ITEM_TYPE` (`ET1904`) when an item's `type` has no registration — previously such items were silently dropped.
- Fixed: `<et-nav-tabs-outlet>` placed as a sibling of `<et-nav-tabs>` (the documented composition) crashed with a DI error. It now resolves the tab bar that labels it automatically when exactly one `et-nav-tabs` exists on the page, and still prefers an ancestor tab bar when nested.
