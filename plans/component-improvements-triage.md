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

> **Shipped 2026-08-06.** The three auth items this list opened with - `sessionStatus` + a logout
> cause, the snapshot-vs-`executionState` docs fix, and the cross-key execution race - are done in
> one pass and moved to "Already fixed" in `component-improvements.md`. `withAuthGuard()` (was #7)
> is now unblocked; it was sequenced deliberately after `sessionStatus`. **Badge `size` + icon
> slot** (was #5) shipped the same day, and **the selection-card dedupe** (was #1) on 2026-08-07 -
> one `.et-selection-card` sheet, one `--et-selection-card-*` token set, all three components on it.
> The tile is now a clean single edit on top of it.
>
> **Shipped 2026-08-07.** The **form-field suffix unification** (was #1) - the clear button, picker
> trigger and reveal toggle of all six controls now render in `.et-form-field-suffix` through a
> `[etControlSuffix]` registration, ahead of the consumer's suffix and the busy spinner, on one
> shared `.et-input-clear` / `.et-input-picker-trigger` stylesheet. It also left behind
> `[etFormFieldBarrier]`, which is what a future control-inside-a-control needs; **select and
> cascader are the obvious next adopters** - both still render their clear button and dropdown arrow
> as plain siblings, and neither was in this item's scope.
>
> **Slider and rating onto `dragGestureFrom`** (was #1) also shipped 2026-08-07 - one gesture per
> press at `commitThreshold: 0`, so both now revert on a cancelled gesture. It left `end` carrying
> the release position (`DragEndEvent`, also `dragEnded`'s payload) and moved the
> `setPointerCapture` try/catch into the primitive. Carousel stays out, as planned.
>
> **The auth route guard** (was #1) shipped 2026-08-07 as `createAuthGuard(providerRef, config)` -
> not the `withAuthGuard()` the backlog guessed at, because a guard is built at route-config time
> and is not a provider feature. It came in well under its `L` estimate: `sessionStatus()` had
> already done the hard part. `shouldAutoLogin` (in the `S` table) is now the last open auth item.
>
> **The scheduler's mobile trio** (was #1) shipped 2026-08-07, all three in one pass - they turned
> out to share one question, which width counts as narrow. It is 480px, the same the header already
> reflowed at, and it now lives twice: as the container query and as a `signalHostElementDimensions()`
> reading in the component, because swapping a text button for a FAB is a component swap, not a
> restyle. The other scheduler items in the `S` table are untouched by it.

1. **Query error rebuilt on banner** - `M`, `C`.
   Identical `color-mix` surface formula, independently reimplemented icon slot, heading,
   description and action row; banner's `type="error"` already forces `injectErrorTheme()`.
   Needs two things layered on: the violation `<ul>` and the retry-only-if-`canRetry` conditional.

2. **Selection list `variant="tile"`** - `M` now, `A`,`D`.
   Was an `L`; the selection-card dedupe turned it into a single edit on one shared sheet. Settle
   its three open questions first - chiefly whether an unchecked tile still reads as selectable -
   because they are design calls, not code.

## Everything else, by effort

### S - small, additive, low risk

| Item                                              | Tag | Note                                                                                                |
| ------------------------------------------------- | --- | --------------------------------------------------------------------------------------------------- |
| Scheduler: richer sub-appointment list            | `A` | Start time + existing chain-count badge; don't grow it into a second card                           |
| Scheduler: agenda connector lines                 | `A` | Draws off the `depth`/`data-nested` the agenda template already emits                               |
| Accordion: border/label transition                | `A` | Precedent in `button.component.css`'s `--_et-button-border-color`; tokens already imported          |
| Progress steps: success/warning/error states      | `A` | Mirror `BANNER_TYPES`, don't invent colour language                                                 |
| Colour input: hex/RGB validators                  | `A` | None exist anywhere today; the `#rrggbb` claim is a doc comment only                                |
| Grid: assert breakpoint coverage in the dev check | `A` | Cheap half of the "nothing ties layout keys to breakpoints" item                                    |
| Filter overlay story: demo dressing               | `A` | Story file only - lorem filler, inline styles, toggle-buttons standing in for fields                |
| Auth: `shouldAutoLogin` predicate                 | `A` | Alongside `excludeRoutes`, so consumers stop prefix-matching substrings                             |
| Query devtools: stop the Queries list repeating   | `A` | One row per query _instance_ is by design; the list should collapse or hide the repeats             |
| Query devtools: locate the selected query         | `A` | Inspect backwards - `entry.meta.element` is already there, and works in a prod build                |
| Query: retire `CLEAR_QUERY_ARGS`                  | `D` | Make `null` mean park; deprecated alias keeps every call site compiling. Nothing uses keep-previous |

### M - real work, mostly consolidation

| Item                                               | Tag     | Note                                                                                                                                        |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Query error on banner                              | `C`     | See #1                                                                                                                                      |
| Grid: thread `TData` through `GridSerializedState` | `A`     | Same family as the registration cast that already shipped                                                                                   |
| Grid: per-breakpoint constraints (`perBreakpoint`) | `A`,`D` | Settle the early-return that makes per-item constraints silently ignored for registered types                                               |
| Progress steps: vertical orientation               | `A`     | Not a CSS flip - the connector is a purpose-built inline-size bar                                                                           |
| Progress steps: steps as links                     | `A`     | Polymorphic root (`span`/`a`/`button`) + the `:hover` rules that don't exist yet                                                            |
| Avatar: extract `AvatarDirective`                  | `C`     | Follow tooltip/toggletip/accordion's headless split                                                                                         |
| Avatar group: `maxVisible` + "+N"                  | `A`     | No "+N" pattern exists anywhere to copy - new surface                                                                                       |
| Description list: `variant`                        | `A`     | Empty class today, five CSS properties; any variant is new surface                                                                          |
| Scheduler: colour palette via DI token             | `A`,`D` | Parallel to `injectColorThemes`; keep free text as fallback                                                                                 |
| Scheduler: infinite agenda                         | `D`     | Lands as a documented `paged-query-stack` consumer pattern - paging belongs to the query, not scheduler                                     |
| Selection list: `variant="tile"`                   | `A`,`D` | See #2 - one edit on the shipped selection-card sheet, once the three design questions are settled                                          |
| Query: long polling                                | `A`,`D` | A completion-driven chain, not an interval - `withPolling` can't express it. Needs next-args-from-last-response, which is the reusable part |

### L - projects, not tickets

| Item                                         | Tag     | Note                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charts                                       | `D`,`L` | Four unknowns stacked: diverge from the `[innerHTML]` SVG precedent, a categorical palette that doesn't exist, `[etTooltip]` unverified on an SVG host, and no mechanism for animating SVG attributes. Bar charts could ship without the last one; pie/sankey can't |
| Scheduler: move/resize existing appointments | `A`     | Called "the natural next feature" by the drag-to-create work                                                                                                                                                                                                        |
| Scheduler: date-time _range_ picker          | `A`     | New `forms/date-time/` surface; `DateRangeInputComponent` is date-only                                                                                                                                                                                              |
| Colour input: custom picker                  | `A`     | Replaces the native input behind the same directive contract                                                                                                                                                                                                        |
| Command palette                              | `A`,`D` | Merged item. Leans on the existing overlay + menu, so cheaper than it looks - but settle the scope before starting, the backlog flags scope creep as the real risk                                                                                                  |
| Stat tile                                    | `A`     | Merged item, marked low / opportunistic. Note the `dataviz` guidance covers stat tiles, so the design language exists even though the component doesn't                                                                                                             |
| Test harnesses                               | `D`     | Merged item. `forms/testing/` has one utility and every spec talks to the DOM directly; CDK-`ComponentHarness`-style drivers are the question. Explicitly "not urgent" - revisit as more controls land                                                              |

### Decide before building

| Item                                   | Why it's stuck                                                                                                                                                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface-coloured button                | `mutedUntilPressed` already _is_ this look, gated behind a state. Whether "surface" becomes a generated `ColorTheme` or a third theming axis needs a design pass, and contrast risk is already flagged                           |
| Storybook top-level categories         | High blast radius - moves every story id the docs site embeds. The two concrete misplacements already shipped; this is the open, bigger call                                                                                     |
| Grid: rename `initialItems` → `items`  | Collides with the directive's existing public `items` computed; resolve that first. The behaviour and docs are already fixed - only the misleading name is left, and it's what made one app rebuild the whole grid on every save |
| Grid: `createGridAdapter` signature    | One position per item can't express the per-breakpoint mapping apps actually write                                                                                                                                               |
| Progress steps: sub-steps              | Least defined ask in the file - projected slot vs description input, and whether it means anything outside vertical                                                                                                              |
| Selection card: leading/trailing slots | Forces `row-reverse` to become a `controlPosition` decision rather than a constant                                                                                                                                               |

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

Everything in the `S` table is independent of everything else and can be picked off in any order.
