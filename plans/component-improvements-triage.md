# Component improvements: triage

A prioritized view of component improvements, written 2026-08-06 and updated when fresh scans
change what is actionable. That file stays the historical record of _what was found and why_; this
one contains only live work, ordered by what to do first.

Sections excluded on purpose: "Already fixed, do not re-report", "Already covered - don't
rebuild", "Overlay responsiveness: resolved", and "Found not to reproduce". Don't re-open them.

Done and removed: the theme-token migration (2026-08-21) - tooltip, toggletip, menu, overlay arrow
and the rich text editor panels now read the derived surface tokens directly, the toggletip focus
ring and action divider are themed, and the tab / nav-tab / segmented-tab interaction fills go
through `--et-theme-color-primary-rgb`.

Also done (2026-08-21): native textarea autosizing. `field-sizing: content` now drives the size
where the browser has it, with the measured path kept behind `@supports` as the fallback - see
`textarea-field-sizing-spike.md` for the measurements and for what to delete once the floor moves
past Firefox ESR and iOS 26.

**Tags.** `A` additive (new input/slot/option, nothing existing changes) · `C` consolidation
(dedupe or reuse; behaviour should come out identical) · `B` correctness · `D` needs a design
decision before any code · `X` blocked.
**Effort** is a rough order of magnitude: `S` under a day · `M` a few days · `L` a week or more.

## By effort

### M - bounded projects

| Item              | Tag     | Note                                                                                                                                                                                                                                                                 |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form test drivers | `C`,`D` | The old “not urgent” call has aged out: 74 form specs now contain about 500 direct DOM-access sites. Start with internal drivers for form field, select, cascader and date-time controls; decide whether a public CDK-`ComponentHarness` API buys enough beyond that |

### L - projects, not tickets

| Item                        | Tag     | Note                                                                                                                                                                                                                                                                |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fullscreen View Transitions | `C`,`D` | Same-document View Transitions reached Baseline in October 2025. Spike whether snapshots really replace trigger cloning and the origin-to-viewport transform contract before retiring the 770-line `fullscreen-animation.ts`; `flip-animation.ts` can follow        |
| Charts                      | `D`,`L` | Four unknowns stacked: diverge from the `[innerHTML]` SVG precedent, a categorical palette that doesn't exist, `[etTooltip]` unverified on an SVG host, and no mechanism for animating SVG attributes. Bar charts could ship without the last one; pie/sankey can't |
| Stat tile                   | `A`     | Merged item, marked low / opportunistic. The `dataviz` guidance already covers stat tiles, so the design language exists even though the component doesn't. Prefer this over charts when the next goal is a bounded new domain                                      |

### Watchlist - still gated on browsers

Merged from `opportunities.md` and re-checked on 2026-08-18. Nothing here is actionable now; the
value is knowing what to re-scan and what it would delete. **Re-check support before planning any
of it.**

| Waiting on                                   | What it would buy                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CSS anchor positioning (complete Firefox)    | Shrinks `overlay-position.ts`'s floating-ui usage. Individual anchor features reached Baseline, but the positioning contract needed here is still incomplete |
| `interpolate-size` / `calc-size` (FF/Safari) | Replaces `animated-block-size.ts`; `interpolate-size` remains limited availability, so do not make it the baseline path yet                                  |

Three decisions in that section are **settled - do not re-open**: the animated-lifecycle
directive pair stays (not a migration target), and `<dialog>`/top-layer plus the Popover API are
rejected outright, because the native top layer breaks consumers that rely on z-index layering.

## Sequencing

1. Build the first internal form test drivers alongside the next form change, then decide whether a
   public harness API is justified.
2. For new component work, prefer stat tile when a bounded addition is wanted. Start charts only
   when its palette, SVG host and animation questions are the work the team intends to take on. The
   next opportunistic follow-up is retro-fitting `<et-scrollbar>` onto the panels that already hide
   their native bar - menu, cascader panel, rich text editor, time picker.
3. Treat the View Transition replacement as a separate compatibility project, not incidental overlay
   cleanup.
