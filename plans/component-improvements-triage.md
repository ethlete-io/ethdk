# Component improvements: triage

A prioritized view of `component-improvements.md`, written 2026-08-06 and updated the same day
when `opportunities.md` was merged into it. That file stays the record of _what was found and
why_; this one is only _what to do first_. Nothing here is new research - every item traces to a
section there.

Sections excluded on purpose: "Already fixed, do not re-report", "Already covered - don't
rebuild", "Overlay responsiveness: resolved", and "Found not to reproduce". Don't re-open them.

**Tags.** `A` additive (new input/slot/option, nothing existing changes) · `C` consolidation
(dedupe or reuse; behaviour should come out identical) · `B` correctness · `D` needs a design
decision before any code · `X` blocked.
**Effort** is a rough order of magnitude: `S` under a day · `M` a few days · `L` a week or more.

## Where this stands

Nothing in this file is blocked any more: the last blocked row, scheduler drag-to-create on real iOS
Safari, was re-tested on 2026-08-12 and passed unchanged - see `component-improvements.md`.

Everything that shipped up to and including 2026-08-12 has been removed from this file - the form
field warning mode, the button surface variants, segmented `variant="tabs"`, the caps-lock warning,
the per-tab inactivity logout, the description list's `variant`, the scheduler's colour palette,
query long polling, scheduler move/resize (the largest `L` row there was) plus its all-day-strip
follow-up, the scheduler's infinite agenda, the query devtools' Web Locks inspector - which was
the last query devtools row - the grid's `initialItems` → `items` rename, the grid's `ET1904`
check vs projected items, `createGridAdapter`'s per-breakpoint signature, the colour input's
contrast validator, the selection card's leading/trailing slots, the progress step's detailed
sub-steps, the Storybook top-level categories, and the scheduler's date-time _range_ picker (which
shipped as `et-date-time-range-input`, the first `L` row to go). Each one's design calls and traps
are recorded in `component-improvements.md`'s "Already fixed, do not re-report". The selection list's `variant="tile"`
was dropped on 2026-08-12 rather than shipped - do not re-add it.

The colour input's custom picker shipped on 2026-08-18 - the first `L` row picked off this list since
the date-time range input. It replaced the native `<input type="color">` outright rather than sitting
beside it, so `nativeControl` and `syncFromNativeInput()` are gone; see
`plans/color-input-custom-picker.md` for the design calls and the traps it turned up.

It raised three follow-ups, and all three shipped on 2026-08-18 as well - see "Colour picker
follow-ups, shipped" below.

The grid's per-breakpoint span constraints shipped on 2026-08-18 too - `constraints.perBreakpoint` on
a registration, `[perBreakpointConstraints]` on `et-grid-item`. It was the last row
`component-improvements.md` still had open outside the `L` projects, so **that file now holds nothing
smaller than an `L`**. Its traps are in "Already fixed, do not re-report".

The forms time-zone row went the same day, and it turned out not to be an `L` at all: `timeZone` on
`et-date-time-input` and `et-date-time-range-input` shows the field in another zone and names the
reader's own underneath, without a single line of zoned arithmetic in the calendar, the time picker
or the scheduler. The value stays an instant throughout. The scheduler's own zoned grid stays out -
23- and 25-hour days make it the separate `L` the docs always said it was. Design calls and the
one-hour-a-year trap are in "Already fixed, do not re-report".

Everything left is an `L` project with nothing left to decide, so the next pick is purely which
project to start.

## Everything else, by effort

### L - projects, not tickets

| Item            | Tag     | Note                                                                                                                                                                                                                                                                |
| --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charts          | `D`,`L` | Four unknowns stacked: diverge from the `[innerHTML]` SVG precedent, a categorical palette that doesn't exist, `[etTooltip]` unverified on an SVG host, and no mechanism for animating SVG attributes. Bar charts could ship without the last one; pie/sankey can't |
| Command palette | `A`,`D` | Merged item. Leans on the existing overlay + menu, so cheaper than it looks - but settle the scope before starting, the backlog flags scope creep as the real risk                                                                                                  |
| Stat tile       | `A`     | Merged item, marked low / opportunistic. Note the `dataviz` guidance covers stat tiles, so the design language exists even though the component doesn't                                                                                                             |
| Test harnesses  | `D`     | Merged item. `forms/testing/` has one utility and every spec talks to the DOM directly; CDK-`ComponentHarness`-style drivers are the question. Explicitly "not urgent" - revisit as more controls land                                                              |

### Colour picker follow-ups, shipped - do not re-report

Raised by the user on 2026-08-18 against the picker that shipped the same day, and all three shipped
that day. Full write-up in `plans/color-input-custom-picker.md`.

| Item                                    | What shipped                                                                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Focus escapes an open anchored panel | Close-on-focus-leave in `createAnchoredPanelController`, so select, cascader, the date pickers and the colour picker all close when focus lands outside. The panes stay non-modal - no trap, no backdrop                          |
| 2. Panel hex field is a bare `<input>`  | The whole footer is one `et-form-field`: the preview swatch and the notation switch as prefixes, the eyedropper as a suffix. Brought the interaction states and the warning slot 3 needed                                         |
| 3. Notation switching (hex / RGB / HSL) | `[notations]` on `et-color-input`. More than one offers a switch and follows what the user types; exactly one pins the field and converts with an advisory. **The emitted value never leaves hex** - the notation is display only |

### Watchlist - gated on browsers, not on us

Merged from `opportunities.md`. Nothing here is actionable now; the value is knowing what to
re-scan and what it would delete. **Re-check support before planning any of it.**

| Waiting on                                   | What it would buy                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| View Transitions (Firefox, same-document)    | The biggest prize in the file: `overlay/strategies/fullscreen-animation.ts` is 733 lines of origin→viewport transform maths plus trigger cloning. VT snapshots pixels, which may also sidestep the Angular style-unload constraint that forced cloning at all. Then `flip-animation.ts` (tab underline, segmented button) |
| CSS anchor positioning (FF/Safari)           | Shrinks `overlay-position.ts`'s floating-ui usage. Do **not** swap yet                                                                                                                                                                                                                                                    |
| `interpolate-size` / `calc-size` (FF/Safari) | Replaces `animated-block-size.ts`; a `@supports` progressive-enhancement fast path is possible sooner                                                                                                                                                                                                                     |
| `field-sizing: content` (FF/Safari)          | Deletes `textarea-autosize.ts` plus ~70-90 lines of `textarea.directive.ts`                                                                                                                                                                                                                                               |

Three decisions in that section are **settled - do not re-open**: the animated-lifecycle
directive pair stays (not a migration target), and `<dialog>`/top-layer plus the Popover API are
rejected outright, because the native top layer breaks consumers that rely on z-index layering.

## Sequencing

Nothing left in this file depends on anything else in it - every remaining row can be picked off in
any order. The one chain that existed, **About → Settings → mock designer → the API export**,
finished on 2026-08-10 with the OpenAPI export.
