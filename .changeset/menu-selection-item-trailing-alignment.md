---
'@ethlete/components': patch
---

Menu: a checkbox/radio item's check, dot or custom icon is pinned to the item's trailing edge again.
Its label's layout was declared in the plain menu item's stylesheet, which is only injected once that
component renders — so in a menu built entirely from selection items (a filter menu, the rich text
editor's heading and alignment menus) the label didn't grow and the indicator sat against the text
instead of the edge.
