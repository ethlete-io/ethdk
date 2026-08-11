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

## The shortlist

Ranked by value per unit of risk, not by size.

**Both of the user's 2026-08-11 picks shipped that day:** the form field warning mode, as the
`warn()` schema rule, and the button surface theming variants, as `tone="surface"` (a third theming
axis on the button rather than a generated `ColorTheme`). **Segmented `variant="tabs"` shipped the
same day**, onto a shared tab scale - which turned out to be the fix for a dead tab size scale as
well; see its section in `component-improvements.md`. The tile below is #1 of what is left, but
parked - see its row.

1. **Selection list `variant="tile"`** - `M` now, `A`,`D`.
   Was an `L`; the selection-card dedupe turned it into a single edit on one shared sheet. Settle
   its three open questions first - chiefly whether an unchecked tile still reads as selectable -
   because they are design calls, not code. **Parked:** the user declined those questions on
   2026-08-09 rather than settling them - do not re-ask unprompted.

## Everything else, by effort

### M - real work, mostly consolidation

| Item                                              | Tag     | Note                                                                                                                                        |
| ------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth: inactivity is per-tab, the logout is shared | `B`,`D` | An idle tab logs out the active one; `resetTimer()` moves the countdown but not the timer. Idleness has to be session-wide                  |
| Description list: `variant`                       | `A`     | Empty class today, five CSS properties; any variant is new surface                                                                          |
| Scheduler: colour palette via DI token            | `A`,`D` | Parallel to `injectColorThemes`; keep free text as fallback                                                                                 |
| Scheduler: infinite agenda                        | `D`     | Lands as a documented `paged-query-stack` consumer pattern - paging belongs to the query, not scheduler                                     |
| Selection list: `variant="tile"`                  | `A`,`D` | See #1 - one edit on the shipped selection-card sheet, once the three design questions are settled                                          |
| Query: long polling                               | `A`,`D` | A completion-driven chain, not an interval - `withPolling` can't express it. Needs next-args-from-last-response, which is the reusable part |
| Query devtools: Web Locks inspector               | `A`,`D` | Origin-wide, so it sees other tabs - but `LockInfo` has no tab identity and Web Locks has no change event. The `isLeader` chip shipped      |

### L - projects, not tickets

| Item                                         | Tag     | Note                                                                                                                                                                                                                                                                           |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Charts                                       | `D`,`L` | Four unknowns stacked: diverge from the `[innerHTML]` SVG precedent, a categorical palette that doesn't exist, `[etTooltip]` unverified on an SVG host, and no mechanism for animating SVG attributes. Bar charts could ship without the last one; pie/sankey can't            |
| Scheduler: move/resize existing appointments | `A`     | Called "the natural next feature" by the drag-to-create work                                                                                                                                                                                                                   |
| Scheduler: date-time _range_ picker          | `A`     | New `forms/date-time/` surface; `DateRangeInputComponent` is date-only                                                                                                                                                                                                         |
| Colour input: custom picker                  | `A`     | Replaces the native input behind the same directive contract                                                                                                                                                                                                                   |
| Command palette                              | `A`,`D` | Merged item. Leans on the existing overlay + menu, so cheaper than it looks - but settle the scope before starting, the backlog flags scope creep as the real risk                                                                                                             |
| Stat tile                                    | `A`     | Merged item, marked low / opportunistic. Note the `dataviz` guidance covers stat tiles, so the design language exists even though the component doesn't                                                                                                                        |
| Test harnesses                               | `D`     | Merged item. `forms/testing/` has one utility and every spec talks to the DOM directly; CDK-`ComponentHarness`-style drivers are the question. Explicitly "not urgent" - revisit as more controls land                                                                         |
| Forms: time-zone handling / local-time UX    | `D`     | User-raised 2026-08-10. Wants an input's date/time also shown in local time, with the user's own caveat that it must not get confusing. Settle what the control's value _is_ (zoned instant vs wall clock + zone) before any UI. Scope date-time, range and scheduler together |

### Decide before building

| Item                                   | Why it's stuck                                                                                                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook top-level categories         | High blast radius - moves every story id the docs site embeds. The two concrete misplacements already shipped; this is the open, bigger call                                                                                     |
| Grid: rename `initialItems` → `items`  | Collides with the directive's existing public `items` computed; resolve that first. The behaviour and docs are already fixed - only the misleading name is left, and it's what made one app rebuild the whole grid on every save |
| Grid: `createGridAdapter` signature    | One position per item can't express the per-breakpoint mapping apps actually write                                                                                                                                               |
| Progress steps: sub-steps              | Least defined ask in the file - projected slot vs description input, and whether it means anything outside vertical                                                                                                              |
| Selection card: leading/trailing slots | Forces `row-reverse` to become a `controlPosition` decision rather than a constant                                                                                                                                               |
| Colour input: contrast validator       | Needs to read another control's value, and nothing in `libs/forms` does a cross-field read today - so the shape is the question, not a missing regex. `hexColor()`/`rgbColor()` shipped without it                               |

### Blocked - and two that may no longer be

| Item                                        | Status                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password input: caps-lock stays on          | **Unblocked as of this triage.** The doc says "blocked on a human at a Mac keyboard" and reasons that no synthetic event can reproduce it, because the quirk is in how macOS delivers the physical key. This repo now runs on macOS (`Darwin`) - so it needs the user to toggle CapsLock on the password-input story once and report what happens. Minutes, not days |
| Scheduler drag-to-create on real iOS Safari | **Recheck.** Recorded as blocked because `idb` wasn't installed on what was then a Linux PC. The machine changed: `xcrun simctl` lists 5 available iPhone simulators locally. `idb` is still missing (so real taps need it, or `safaridriver`), but the blocker's premise no longer holds - re-test before treating it as blocked                                    |

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
