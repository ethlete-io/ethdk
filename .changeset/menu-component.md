---
'@ethlete/components': minor
---

Add a new `Menu` component and headless menu primitives. It provides a fully accessible, overlay-anchored menu system built on the styled components `MenuComponent` (`et-menu`), `MenuItemComponent` (`et-menu-item`), `MenuItemShortcutComponent` (`et-menu-item-shortcut`), `MenuSeparatorComponent` (`et-menu-separator`), `MenuGroupLabelComponent` (`et-menu-group-label`), and the selection components `MenuRadioGroupComponent` / `MenuRadioItemComponent` and `MenuCheckboxGroupComponent` / `MenuCheckboxItemComponent`. All are bundled in `MenuImports`.

Highlights:

- Open a menu from any element with `etMenuTrigger`, nest submenus, and open at the pointer as a right-click context menu with `etMenuContextTrigger`.
- Full keyboard support with roving focus, typeahead, and configurable hover intent so submenus don't flicker on diagonal pointer movement.
- Single- and multi-select groups (`radio` / `checkbox` semantics) via `etMenuSelectionGroup` / `etMenuSelectionItem`.
- Built-in filtering with `input[etMenuSearch]`, including async search sources.
- Headless directives (`etMenu`, `etMenuPanel`, `etMenuItem`, `etMenuTrigger`, `etMenuContextTrigger`, `etMenuSelectionGroup`, `etMenuSelectionItem`, `etMenuSurface`, `input[etMenuSearch]`) are exported for building custom menu UIs.
