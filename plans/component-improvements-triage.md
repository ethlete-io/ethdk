# Component improvements: triage

Live work only, ordered by what to do first. Finished items are removed; git history has them.

## Light-surface contrast in stories

`SurfaceTheme.semanticColorThemes` (`44b743455`) lets a surface pick the colour theme for a
semantic type. Storybook maps `error` and `success` on `light` and `light-elevated` to
`danger-on-light` and `success-on-light`. Rejected on the way, do not re-open: an ink per surface
type on the colour theme (`inkColorBySurfaceType`, reverted in `ad6028304`) and an ink derived
with `color-mix` (it invents colours).

- `brand-on-light` (emerald 700 ink) and `warning-on-light` (amber 800 ink) exist, chosen in the
  call `components/on-light-ink/00-brand-warning`: each theme takes the lightest step that clears
  AA on every badge. The badge story draws a `light` row with them; tonal and outline pass.
- Filled success and warning take neutral 900 text on their shipped fills (call
  `components/on-light-ink/01-filled-text`), so every filled badge passes on all four surfaces.
- The scheduler has `LightSurface`, `LightSurfaceWeek` and `LightSurfaceAgenda` stories. The
  appointment time and location dropped `opacity: 0.75` for a 600-weight title (call
  `components/scheduler-contrast/00-secondary-text`). The warning theme has an amber 500 dark
  ink (call `components/on-light-ink/02-warning-dark-ink`). Outside-month dates take
  `colorMuted` instead of `colorSubtle` (call `components/scheduler-contrast/01-outside-dates`;
  weight 300 and a shaded cell lost). The today button takes `brand-on-light` from the new
  `SurfaceTheme.colorTheme` (call `scheduler-contrast/02-today-button`, B). The three light
  scheduler stories pass axe `color-contrast`.
- Two axe `color-contrast` scans of all 587 `components-*` stories (2026-10-02): one as shipped
  (root surface dark, 45 failing stories), one with the root surface switched to `light` from the
  script (`ng.getDirectives` on `ethlete-sb-root`, then the `html` background and colour). In the
  light scan, `#fafafa`/`#a1a1a1` on white is an artifact: those stories nest a dark surface that
  paints no background. Overlay content also sits outside the root surface. Open calls, drawn and
  settled 2026-10-02:
  - Calendar outside dates and week numbers take muted (`calendar-contrast/00-outside-dates`).
    The select and cascader placeholder takes muted (`forms-contrast/00-placeholder`). Form errors,
    warnings, support messages and the counter take the ink (`forms-contrast/01-message-ink`).
  - Storybook palette: light muted is neutral 600 (`surface-palette/01-muted-on-light`), and
    `dark-elevated-2` and `-3` muted is neutral 300 (`surface-palette/00-muted-on-elevated`).
  - Done: `scheduler-contrast/02-today-button` chose B. `SurfaceTheme.colorTheme` names the colour
    theme an `[etProvideSurface]` element applies to its subtree. An `[etProvideColor]` with a colour
    on or above the surface element wins. Storybook maps light surfaces to `brand-on-light` and dark
    ones to `brand`.
- The Storybook light surfaces map `warning` to `warning-on-light`. The error messages of the token popup, dropzone, select,
  cascader and menu search take the ink, like `01-message-ink`. Open, waits on the user: text that
  still takes `--et-theme-color-primary-solid` - the rich-text link, the form field label and affix
  in error, the destructive menu item, the table sort priority and the current progress step
  marker. Icons in primary (select and menu checks, rating, spinner) are non-text and stay.
- Scan findings left out on purpose: disabled labels, hints and calendar dates (WCAG exempts
  inactive controls), story data that names a dark theme (scheduler and avatar on light), and
  hardcoded colours in the `layout-scrollable`, `layout-masonry`, `layout-grid` and
  `color-input-contrast` stories.
- The touch e2e "range instead of swiping" in `apps/storybook-e2e/src/scheduler` fails on
  `:4400` before these changes too: the edit surface does not open as a full-screen dialog.

## Run the error-color-theme migration on a consumer

`error-color-theme-signal` (`dd4a84727`, `1.0.0-next.67`) rewrites `.errorColorTheme` reads on
`injectFormSupport()` and `TableComponent` to calls. It is syntactic and has run only in Nx tree
tests. Run it with `et update` on a scratch copy of fut-frontend once next.67 ships, and check
that it changes nothing else.

## Watchlist - gated on browsers

Nothing here is actionable now. **Re-check support before planning any of it.** Last checked
2026-08-18.

| Waiting on                                   | What it would buy                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CSS anchor positioning (complete Firefox)    | Shrinks `overlay-position.ts`'s floating-ui usage. Individual anchor features reached Baseline, but the positioning contract needed here is still incomplete |
| `interpolate-size` / `calc-size` (FF/Safari) | Replaces `animated-block-size.ts`; `interpolate-size` remains limited availability, so do not make it the baseline path yet                                  |

## Settled - do not re-open

- Chart design calls: all ruled and built by 2026-10-01. Each verdict and its reason is in the
  `call.ts` of its folder under `.ethlete/design/calls/components/` (bar, sankey, pie, line charts).
- The animated-lifecycle directive pair stays. It is not a migration target.
- `<dialog>`/top-layer and the Popover API are rejected: the native top layer breaks consumers that
  rely on z-index layering.
- Fullscreen View Transitions: rejected by the user on 2026-09-23. Interruption does not reverse,
  input is blocked for the transition, and only one transition runs per document.
  `fullscreen-animation.ts` and `flip-animation.ts` stay.
- No public `ComponentHarness` API. It would freeze internal DOM as API and needs a new entry point
  with an `@angular/cdk/testing` dependency. Re-open only when a consumer asks, for the controls it
  names.
- The form field gets no test driver, and the ARIA-state controls (checkbox, selection list,
  slider) get no shared driver base.
