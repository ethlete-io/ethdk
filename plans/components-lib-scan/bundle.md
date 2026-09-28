# Components tree-shaking and bundle size scan - open findings

Scan of `libs/components` (entry point, `package.json`, `ng-package.json`, module-scope statements, shared internals, CSS) and `tools/treeshake` from 2026-09-28. 1 Medium, 5 Low (Medium verified). Skipped: per-domain bugs (other scans), the items the treeshake README marks as settled, `libs/cdk`.

All numbers are gz bytes in `--external` mode, measured on a fresh build of `next` at `454a2c461`. `nx run treeshake:bundle-goldens` passes. Four stream and RTE entries drift +111 to +145 B inside the tolerance.

## Package floor

- Medium: two module-scope pins remain in the `@ethlete/components` floor: `STATE_ICONS` (`progress-steps/progress-step.component.ts`, computed keys reading `PROGRESS_STEP_STATES`) and `MINIMUM_DURATION` / `DEFAULT_DRAFT_DURATION` (`scheduler/scheduler-time-grid-view.component.ts`, arithmetic on identifiers). Write literal keys and numbers (`complete`, `900_000`). The rest of the list was fixed (floor 3,602 -> 2,870 B). S
- Low: `ethlete/no-impure-top-level-provider` flags only calls and `new` at module scope, so nothing stops new pins of the shape above (`libs/eslint-plugin/src/rules/no-impure-top-level-provider.js`). The README names member reads as one of the three blockers, but no lint rule checks for them. Extend the rule to flag member reads, spreads and binary operators on identifiers in module-scope initializers. Do this together with the fix above so the rule starts clean. M

## Eager dependencies

- Low: `NAV_TAB_IMPORTS` includes `OverlayNavTabLinkComponent` and `NavTabsOutletComponent`, so plain router nav tabs also pay for the overlay-router link (`tabs/tabs.imports.ts`). `NAV_TAB_IMPORTS` measures 30,563 B and `NavTabsComponent + NavTabLinkComponent` measures 28,435 B, a difference of 2.1 kB. To fix, split an `OVERLAY_NAV_TAB_IMPORTS` barrel. This is a breaking change, of the same kind as the barrel splits the README rejects, so decide first. S

## Guard coverage

- Low: `goldens.json` has no entry for the most common primitives, so a regression there is not caught. These are the current sizes to record: `BUTTON_IMPORTS` 13,308, `ButtonComponent` 10,378, `TOOLTIP_IMPORTS` 25,062, `TAB_IMPORTS` 29,484, `MENU_IMPORTS` 35,066 (it has only the `+3p` entry), `CHECKBOX_IMPORTS` 7,592, `PASSWORD_INPUT_IMPORTS` 32,844, `CAROUSEL_IMPORTS` 31,929, `GRID_IMPORTS` 29,235, `COLOR_INPUT_IMPORTS` 50,425 and `CASCADER_IMPORTS` 54,594. Add those entries with `"gzip": 0` and run `:update`. S
- Low: `decompose.mjs` attributes the retained floor literals to unrelated templates. `BUTTON_IMPORTS` shows `bracket/bracket.component.html` at 2,682 B, and `GRID_IMPORTS` shows `forms/tag-input/tag-input.component.html` at 1,577 B. Neither component is in its dump (checked with `dump-bundle.mjs`). This makes the floor pins above look like template cost. Add this to the README "Reading the numbers" list, or attribute each statement by its own sourcemap segment. S

## CSS

- Low: 13 stylesheets each declare their own visually-hidden rule (`clip-path: inset(50%)` / `clip: rect(0 …)`): `kbd`, `password-input`, `counter`, `phone-input`, `dropzone`, `match-card`, `standings`, `standings-pick`, `skeleton`, `chart-data-table`, `scheduler`, `scheduler-month-view` and `bracket-pick-card`. gzip removes most of the byte cost. Each copy is still a separate rule that the browser parses and that can drift. Put one shared `.et-visually-hidden` class in core. S
