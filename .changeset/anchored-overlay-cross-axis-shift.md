---
'@ethlete/core': minor
'@ethlete/components': minor
---

Anchored overlays: the `shift` option now also accepts `{ crossAxis?: boolean }` in addition to a boolean. With `crossAxis: true`, an overlay that fits on neither side of its reference is shifted along the placement's cross axis to stay inside the viewport (it may then overlap the reference) instead of overflowing off-screen.

Menus enable this by default: a nested submenu near the viewport edge first flips to the other side and, when neither side fits, slides over its parent menu — matching native OS menu behavior — instead of being cut off by the viewport.

The `size` middleware (`autoResize`) now runs after `shift` instead of before it, so `--et-overlay-max-width` / `--et-overlay-max-height` are measured from the pane's shifted position. Previously a cross-axis-shifted pane had its max size capped to the unshifted leftover space, squeezing e.g. a submenu to a sliver instead of letting it keep its width while overlapping its parent.
