---
'@ethlete/components': minor
---

Chip: new `et-chip` component (pill with optional remove button, Backspace/Delete removal) plus headless `[etChip]` / `[etChipRemove]` directives, exported as `CHIP_IMPORTS`.

- Selection list: the item registry/selection API moved from the group directive onto its `selection` property (`list.selection.select(...)` instead of `list.select(...)` on the `SELECTION_LIST_TOKEN` contract); group behavior is unchanged.
- `SelectionListItem` gains optional `id` and `label` signals.
