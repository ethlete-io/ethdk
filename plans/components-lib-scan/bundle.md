# Components tree-shaking and bundle size scan - open findings

Scan of `libs/components` (entry point, `package.json`, `ng-package.json`, module-scope statements, shared internals, CSS) and `tools/treeshake` from 2026-09-28. 0 Medium, 1 Low (1 Low fixed 2026-09-29: `OVERLAY_NAV_TAB_IMPORTS` split, router nav tabs 28,320 B, in a61508d1f; floor pins and the `forbidImpureReads` lint option fixed 2026-09-29, floor 2,870 B). Skipped: per-domain bugs (other scans), the items the treeshake README marks as settled, `libs/cdk`.

All numbers are gz bytes in `--external` mode, measured on a fresh build of `next` at `454a2c461`. `nx run treeshake:bundle-goldens` passes. Four stream and RTE entries drift +111 to +145 B inside the tolerance.

## CSS

- Low: 16 stylesheets each declare their own visually-hidden rule (`clip-path: inset(50%)` / `clip: rect(0 …)`): `kbd`, `password-input`, `counter`, `phone-input`, `dropzone`, `match-card`, `match-participant`, `standings`, `standings-pick`, `skeleton`, `progress-step`, `chart-data-table`, `scheduler`, `scheduler-month-view`, `bracket-pick-card` and the multi-language rich text editor language tool. gzip removes most of the byte cost. Each copy is still a separate rule that the browser parses and that can drift. Put one shared `.et-visually-hidden` class in core. S
