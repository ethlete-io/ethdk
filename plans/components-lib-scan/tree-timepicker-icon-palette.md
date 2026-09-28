# tree, time-picker, icon, command-palette scan - open findings

Scan of `libs/components/src/lib/{tree,time-picker,icon,command-palette}` from 2026-09-28. 0 High, 0 Medium, 0 Low, 3 Spec. Skipped: stories, the 50 icon data files (read one as a sample), CSS beyond the layer, colour and comment checks.

## icon

No icon set lands in every bundle: each component registers only its own icon constants, `sideEffects: false` is set, and `ET_BUILT_IN_ICON_NAMES` is a list of names without SVG data.

## Spec gaps

- Spec: the tree has no spec for the headless directive. Nothing covers collapse-then-reopen of a failed branch, `retry` during a load, or `expandedValues` restored before the branch loads. M
- Spec: the time-picker specs do not cover `min > max`, a value with hidden seconds against `max`, or 12-hour period switching under a bound. S
- Spec: no command-palette spec covers IME composition or a duplicate group id. S
