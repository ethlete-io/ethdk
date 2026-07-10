---
'@ethlete/components': minor
---

Menu: trigger-anchored root menus now render a floating arrow pointing at their trigger, matching the tooltip and toggletip look. The new `arrow` input on `[etMenu]` (default `true`) controls it — set `[arrow]="false"` to opt out — and `arrowPadding` (default `8`) tunes how close the arrow may get to the panel corners. Submenus and context menus (point-anchored) never render an arrow.

- With the arrow enabled, the `'auto'` offset resolves to `10` so the arrow has room between the panel and its trigger; disabling the arrow restores the previous tight spacing. Submenu and context menu spacing is unchanged.
- The arrow picks up the menu surface theme (`--et-surface-background-solid` / `--et-surface-border-solid`) and can be overridden via `--et-overlay-arrow-background` and `--et-overlay-arrow-border`.
