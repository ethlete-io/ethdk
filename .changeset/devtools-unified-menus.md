---
'@ethlete/components': minor
---

Query devtools: every menu is now the SDK's `et-menu` - the layout picker (a radio group), the tab overflow, and the detail pane's Copy and Override menus. Overlays resolve their document from the trigger, and the pop-out mirrors the host document's stylesheets while it is open, so all of them - including the value explorer's copy/override menus, which previously opened in the wrong window - work inside the popped-out panel.
