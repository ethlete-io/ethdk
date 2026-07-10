---
'@ethlete/components': minor
---

Menu: the menu now fully respects the surface and color theming systems instead of shipping a hardcoded dark palette.

- Borders, separators, muted text (group labels, shortcuts, the search placeholder/spinner) and the search input fill now derive from the surface tokens (`--et-surface-border-solid`, `--et-surface-color-muted-solid`, `--et-surface-interaction-solid`).
- The active menu item highlight is now a `color-mix` tint of `--et-surface-interaction-solid` instead of a fixed white overlay.
- The menu panel resolves its surface via `AutoSurfaceDirective`, automatically picking the next elevation relative to the trigger's surface context.
- Destructive menu items and the search error message now use the app's registered `error` color theme (via `injectErrorTheme()`), so `--et-theme-color-primary-*` resolves to the error palette inside them. The `--et-menu-item-destructive-color` token has been removed — theme the error color theme instead. Like `et-form-field`, `et-menu` now requires color themes (including one with `type: 'error'`) to be registered.
- Selection item check/radio marks and the search input focus border now use `--et-theme-color-primary-solid` from the surrounding color theme context.
- The active-item highlight now only shows for an actual hover or `:focus-visible` (keyboard) interaction — opening a menu with the mouse no longer highlights the first item, while keyboard-opened menus still do. A trigger item whose submenu is open stays highlighted via `[data-menu-open]`.
- The menu animates its block size (160ms) when its content changes while open — e.g. search filtering items away or the search error line appearing — instead of snapping to the new size. Respects `prefers-reduced-motion`.
- Menu items now have a pressed (`:active`) state — a stronger tint of the surface interaction color (20% vs the 12% highlight) — and transition `background`, `color` and `opacity` (120ms) between their rest, highlighted, pressed and disabled states. The search input transitions its `border-color` and `background`, matching the button's interaction feel.
