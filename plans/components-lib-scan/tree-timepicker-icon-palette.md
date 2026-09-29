# tree, time-picker, icon, command-palette scan - open findings

Scan of `libs/components/src/lib/{tree,time-picker,icon,command-palette}` from 2026-09-28. 0 High, 0 Medium, 0 Low, 1 Spec. Skipped: stories, the 50 icon data files (read one as a sample), CSS beyond the layer, colour and comment checks.

## icon

No icon set lands in every bundle: each component registers only its own icon constants, `sideEffects: false` is set, and `ET_BUILT_IN_ICON_NAMES` is a list of names without SVG data.

## Spec gaps

- Spec: no command-palette spec covers a duplicate group id. (IME composition is now covered.) S
