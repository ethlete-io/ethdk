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
- The scheduler stories still use fixed event `colorToken` names and have no light row.
- Axe failures on `dark` that predate this work: scheduler date number 3.78:1, danger event time
  3.92:1, month-view outside dates `#737373`, the warning appointment text `#af620a` on
  `#322415` 3.27:1. The warning theme has no dark ink, so the scheduler warning time is
  `#d97706` on `#392c1c`, 4.24:1.

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
