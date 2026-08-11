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
follow-up, the scheduler's infinite agenda, and the query devtools' Web Locks inspector - which was
the last query devtools row. Each one's design calls and traps are recorded in
`component-improvements.md`'s "Already fixed, do not re-report". The selection list's
`variant="tile"` was dropped on 2026-08-12 rather than shipped - do not re-add it.

Nothing is left at `M`. What remains is the `L` projects and the rows that need a decision before
any of them can start, so the next pick is a scoping call rather than a queue position.

## Everything else, by effort

### L - projects, not tickets

| Item                                      | Tag     | Note                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Charts                                    | `D`,`L` | Four unknowns stacked: diverge from the `[innerHTML]` SVG precedent, a categorical palette that doesn't exist, `[etTooltip]` unverified on an SVG host, and no mechanism for animating SVG attributes. Bar charts could ship without the last one; pie/sankey can't            |
| Scheduler: date-time _range_ picker       | `A`     | New `forms/date-time/` surface; `DateRangeInputComponent` is date-only                                                                                                                                                                                                         |
| Colour input: custom picker               | `A`     | Replaces the native input behind the same directive contract                                                                                                                                                                                                                   |
| Command palette                           | `A`,`D` | Merged item. Leans on the existing overlay + menu, so cheaper than it looks - but settle the scope before starting, the backlog flags scope creep as the real risk                                                                                                             |
| Stat tile                                 | `A`     | Merged item, marked low / opportunistic. Note the `dataviz` guidance covers stat tiles, so the design language exists even though the component doesn't                                                                                                                        |
| Test harnesses                            | `D`     | Merged item. `forms/testing/` has one utility and every spec talks to the DOM directly; CDK-`ComponentHarness`-style drivers are the question. Explicitly "not urgent" - revisit as more controls land                                                                         |
| Forms: time-zone handling / local-time UX | `D`     | User-raised 2026-08-10. Wants an input's date/time also shown in local time, with the user's own caveat that it must not get confusing. Settle what the control's value _is_ (zoned instant vs wall clock + zone) before any UI. Scope date-time, range and scheduler together |

### Decide before building

| Item                                   | Why it's stuck                                                                                                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook top-level categories         | High blast radius - moves every story id the docs site embeds. The two concrete misplacements already shipped; this is the open, bigger call                                                                                     |
| Grid: rename `initialItems` → `items`  | Collides with the directive's existing public `items` computed; resolve that first. The behaviour and docs are already fixed - only the misleading name is left, and it's what made one app rebuild the whole grid on every save |
| Grid: `createGridAdapter` signature    | One position per item can't express the per-breakpoint mapping apps actually write                                                                                                                                               |
| Progress steps: sub-steps              | Least defined ask in the file - projected slot vs description input, and whether it means anything outside vertical                                                                                                              |
| Selection card: leading/trailing slots | Forces `row-reverse` to become a `controlPosition` decision rather than a constant                                                                                                                                               |
| Colour input: contrast validator       | Needs to read another control's value, and nothing in `libs/forms` does a cross-field read today - so the shape is the question, not a missing regex. `hexColor()`/`rgbColor()` shipped without it                               |

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
