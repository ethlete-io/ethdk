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

Also done (2026-08-21): the internal form test drivers, in three passes.
`libs/components/src/lib/testing/` holds the shared core - `driver-core.ts`, the
`control-driver.ts` base, and the two families built on it (`overlay-control-driver.ts`,
`field-control-driver.ts`). `libs/components/src/lib/forms/testing/` holds the per-control
drivers: `select-driver.ts`, `cascader-driver.ts`, `date-picker-driver.ts`,
`number-input-driver.ts`, `password-input-driver.ts`, `tag-input-driver.ts`,
`color-input-driver.ts`, `checkbox-driver.ts`, `selection-list-driver.ts` and `slider-driver.ts`.
Twenty-one specs now drive their control through a driver instead of the DOM: select, cascader,
all eight date-time specs, the text input, number input, password input, tag input and colour
input, the checkbox, the selection list (group, option and the checkbox-group select-all) and both
sliders. Every converted control went to zero direct DOM sites; the plain input needs no
per-control driver and uses `mountFieldControl` with `InputDirective` directly. The forms specs
are down from 383 direct DOM sites to 283. The `testing/` folder is excluded from the lib build,
so nothing here ships.

Three decisions from those passes:

- **The form field gets no driver.** Its six specs hold 14 `querySelector` calls in total, each a
  one-line structural assertion ("is the control's affordance inside the suffix slot?"). A driver
  would add a layer without removing a repetition.
- **No shared base for the controls whose state lives in ARIA attributes.** Their targets differ
  too much for one family: a checkbox is a single element, a selection list is a group plus N
  options plus an optional select-all, and a slider is a host plus thumbs, a track and marks. Each
  of those three drivers extends `control-driver.ts` directly and names its own elements. None of
  them edits a native `input`, so `field-control-driver.ts` fits none of them.
- **No public `ComponentHarness` API.** The drivers earn their keep by removing jsdom ceremony -
  `tick()`, two animation frames, and the newest-overlay-pane lookup - which is a test-environment
  concern, not a consumer-facing one. A published harness would instead freeze internals as API:
  `.et-overlay-runtime-pane`, `[data-active]`, `.et-select-value` and `injector.get(SelectDirective)`
  are what the drivers read, and every internal DOM change would become a breaking change for
  consumers. It also needs a new published entry point with an `@angular/cdk/testing` dependency.
  No consumer has asked for it. Re-open only when one does, and only for the controls it names.

**Tags.** `A` additive (new input/slot/option, nothing existing changes) · `C` consolidation
(dedupe or reuse; behaviour should come out identical) · `B` correctness · `D` needs a design
decision before any code · `X` blocked.
**Effort** is a rough order of magnitude: `S` under a day · `M` a few days · `L` a week or more.

## By effort

### M - bounded projects

| Item              | Tag | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form test drivers | `C` | Three passes done, see the 2026-08-21 note above. What is left, by size: the rich text editor DOM utilities (48 sites - the DOM is the subject there, so leave them), the dropzone component (41), select virtual options (15), switch (12), the form-field suffix slot (12), textarea, rating and phone input (10 each). Switch is checkbox-shaped; textarea, phone input and OTP input fit `field-control-driver.ts`; the dropzone edits no `input`, so it needs its own base |

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

1. Extend the form test drivers to the controls that still have none. Take the field-shaped
   stragglers first - switch, textarea, rating, phone input, OTP input - then the dropzone, which
   needs a base of its own. Do each alongside the next change to that control. Leave
   `rich-text-editor-dom.spec.ts` as it is: it tests DOM utilities, so direct DOM access is the
   subject there, not ceremony. The overlay-backed controls, the text-field family, the checkbox,
   the selection list, both sliders and the harness decision are done.
2. For new component work, prefer stat tile when a bounded addition is wanted. Start charts only
   when its palette, SVG host and animation questions are the work the team intends to take on. The
   next opportunistic follow-up is retro-fitting `<et-scrollbar>` onto the panels that already hide
   their native bar - menu, cascader panel, rich text editor, time picker.
3. Treat the View Transition replacement as a separate compatibility project, not incidental overlay
   cleanup.
