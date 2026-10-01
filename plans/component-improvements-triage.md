# Component improvements: triage

Live work only, ordered by what to do first. Finished items are removed; git history has them.

## Chart follow-ups

- Sankey: the call 10 B drawing has a muted key hint in the link tooltip ("1 of 2 · ↑↓ next link · Esc back to …"). Not built; it needs text inputs that can be translated.

## Stat tile

A new component, not started. Low priority, opportunistic. The `dataviz` guidance already covers
stat tiles, so the design language exists. Prefer it when the next goal is a bounded new domain.

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
