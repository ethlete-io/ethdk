# Components tree-shaking and bundle size scan - open findings

Scan of `libs/components` (entry point, `package.json`, `ng-package.json`, module-scope statements, shared internals, CSS) and `tools/treeshake` from 2026-09-28. 1 Medium, 2 Low (Medium verified; 1 Low fixed 2026-09-29: `OVERLAY_NAV_TAB_IMPORTS` split, router nav tabs 28,320 B, in a61508d1f). Skipped: per-domain bugs (other scans), the items the treeshake README marks as settled, `libs/cdk`.

All numbers are gz bytes in `--external` mode, measured on a fresh build of `next` at `454a2c461`. `nx run treeshake:bundle-goldens` passes. Four stream and RTE entries drift +111 to +145 B inside the tolerance.

## Package floor

- Medium: two module-scope pins remain in the `@ethlete/components` floor: `STATE_ICONS` (`progress-steps/progress-step.component.ts`, computed keys reading `PROGRESS_STEP_STATES`) and `MINIMUM_DURATION` / `DEFAULT_DRAFT_DURATION` (`scheduler/scheduler-time-grid-view.component.ts`, arithmetic on identifiers). Write literal keys and numbers (`complete`, `900_000`). The rest of the list was fixed (floor 3,602 -> 2,870 B). S
- Low: `ethlete/no-impure-top-level-provider` flags only calls and `new` at module scope, so nothing stops new pins of the shape above (`libs/eslint-plugin/src/rules/no-impure-top-level-provider.js`). The README names member reads as one of the three blockers, but no lint rule checks for them. Extend the rule to flag member reads, spreads and binary operators on identifiers in module-scope initializers. Do this together with the fix above so the rule starts clean. M

## CSS

- Low: 16 stylesheets each declare their own visually-hidden rule (`clip-path: inset(50%)` / `clip: rect(0 …)`): `kbd`, `password-input`, `counter`, `phone-input`, `dropzone`, `match-card`, `match-participant`, `standings`, `standings-pick`, `skeleton`, `progress-step`, `chart-data-table`, `scheduler`, `scheduler-month-view`, `bracket-pick-card` and the multi-language rich text editor language tool. gzip removes most of the byte cost. Each copy is still a separate rule that the browser parses and that can drift. Put one shared `.et-visually-hidden` class in core. S
