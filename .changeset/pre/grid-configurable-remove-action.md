---
'@ethlete/components': minor
---

Grid: replace the built-in `✕` remove button and its `showDefaultRemoveAction` config option with `GridItemDefaultActionsComponent` (`et-grid-item-default-actions`) - a toolbar with an icon remove button that is now rendered by default. It is used automatically when the grid config leaves `actionsComponent` unset; set `actionsComponent` to your own component to replace it, or to `null` to render no actions. Its aria label is configurable via the new `removeActionAriaLabel` grid config option (defaults to `'Remove item'`, run through `transformer`).

Also removes the now-redundant drag-handle slot: the `dragHandleComponent` config option, the `dragHandleAriaLabel` config option, and the `etGridItemDragHandle` projection slot are gone. With whole-item drag the item content is the drag surface, so a dedicated handle is no longer needed - project a decorative grip into the item content instead.
