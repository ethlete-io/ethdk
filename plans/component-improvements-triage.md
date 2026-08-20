# Component improvements: triage

A prioritized view of component improvements, written 2026-08-06 and updated when fresh scans
change what is actionable. That file stays the historical record of _what was found and why_; this
one contains only live work, ordered by what to do first.

Sections excluded on purpose: "Already fixed, do not re-report", "Already covered - don't
rebuild", "Overlay responsiveness: resolved", and "Found not to reproduce". Don't re-open them.

**Tags.** `A` additive (new input/slot/option, nothing existing changes) · `C` consolidation
(dedupe or reuse; behaviour should come out identical) · `B` correctness · `D` needs a design
decision before any code · `X` blocked.
**Effort** is a rough order of magnitude: `S` under a day · `M` a few days · `L` a week or more.

## By effort

### S - bounded cleanup

| Item                             | Tag     | Note                                                                                                                                                                                                                                                              |
| -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finish the theme-token migration | `C`,`S` | Tooltip/toggletip still fall back through legacy raw surface tokens; toggletip hardcodes its focus ring and action divider. Tabs and segmented tabs duplicate active interaction fills through raw `--et-color-primary`. Move these onto the derived theme tokens |

### M - bounded projects

| Item                       | Tag     | Note                                                                                                                                                                                                                                                                 |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native textarea autosizing | `C`,`D` | `field-sizing: content` reached Baseline in June 2026. Spike it against `rows`, `minRows`, `maxRows`, mixed values and hidden/revealed fields; if those hold, remove the `ResizeObserver`/measurement effect and `textarea-autosize.ts`                              |
| Form test drivers          | `C`,`D` | The old “not urgent” call has aged out: 74 form specs now contain about 500 direct DOM-access sites. Start with internal drivers for form field, select, cascader and date-time controls; decide whether a public CDK-`ComponentHarness` API buys enough beyond that |

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

1. Take the theme-token cleanup and the textarea `field-sizing` spike; both are bounded and remove
   stale infrastructure or conventions.
2. Build the first internal form test drivers alongside the next form change, then decide whether a
   public harness API is justified.
3. For new component work, prefer stat tile when a bounded addition is wanted. Start charts only
   when its palette, SVG host and animation questions are the work the team intends to take on. The
   next opportunistic follow-up is retro-fitting `<et-scrollbar>` onto the panels that already hide
   their native bar - menu, cascader panel, rich text editor, time picker.
4. Treat the View Transition replacement as a separate compatibility project, not incidental overlay
   cleanup.
