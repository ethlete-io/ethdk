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
> is now unblocked; it was sequenced deliberately after `sessionStatus`.

1. **Selection list: one card presentation instead of three** - `M`, `C`.
   `radio.component.css:160` and `checkbox-option.component.css:176` are the same ~75 lines with
   the names swapped - same comments, copied verbatim - and `choice-field-card-styles` is a third.
   Three token sets mean an app changes a card radius three times. Bundle angle too: only the
   choice-field copy is mounted lazily, so ~40% of two always-injected stylesheets ships to apps
   that only ever use `variant="plain"`.

2. **Form field: route clear and picker-trigger through `[etInputSuffix]`** - `M`, `C`.
   Six controls (date, date-time, date-range, time, phone, password) render those buttons as
   plain siblings that only _look_ like a suffix, so form-field's documented append-after rule -
   the one written precisely so a spinner never displaces a clear button - doesn't govern the
   stack it was written for.

3. **Slider and rating onto `dragGestureFrom`** - `M`, `C`.
   Both hand-roll pointerdown/move/up, `setPointerCapture` and a `dragging` flag that
   `dragGestureFrom` already provides. The extra argument on top of dedupe: the cancelled-gesture
   fix already landed _in_ `dragGestureFrom` (`drag-resize-cancelled-gesture.md`), so consolidating
   hands slider and rating a fix they don't have today. Leave carousel out - its deadzone
   semantics differ enough that folding it in is a separate call.

4. **Auth: a `withAuthGuard()` helper** - `L`, `A`.
   The SDK ships no `CanMatchFn`/`CanActivateFn` at all, so every app hand-rolls "wait for auth to
   settle, redirect to login, come back to the attempted URL" - and keeps the return-URL param
   name in sync with the redirect by hand. High value, and now unblocked - `sessionStatus()` ships,
   so the guard has the thing to wait on.

5. **Badge: `size` input and an icon slot** - `S`, `A`.
   The cheapest component win in the file. Tooltip and toggletip already compose as directives on
   the trigger, so the real gap is exactly these two.

6. **Scheduler's cheap mobile trio** - `S` each, `A`.
   Add-appointment as a FAB below a breakpoint, the today button as an icon button at narrow
   widths, and swipe-to-navigate. All three reuse primitives that already exist and that scheduler
   simply doesn't import (`floating-action.directive.ts`, `SwipeTracker` in `libs/core`).

7. **Query error rebuilt on banner** - `M`, `C`.
   Identical `color-mix` surface formula, independently reimplemented icon slot, heading,
   description and action row; banner's `type="error"` already forces `injectErrorTheme()`.
   Needs two things layered on: the violation `<ul>` and the retry-only-if-`canRetry` conditional.

## Everything else, by effort

### S - small, additive, low risk

| Item                                              | Tag | Note                                                                                       |
| ------------------------------------------------- | --- | ------------------------------------------------------------------------------------------ |
| Scheduler: today button as icon button            | `A` | Styling only; `headless.goToToday()` unchanged                                             |
| Scheduler: add-appointment FAB                    | `A` | `floating-action` exists, unused by scheduler                                              |
| Scheduler: swipe navigation                       | `A` | `SwipeTracker` exists, used by drag-handle                                                 |
| Scheduler: richer sub-appointment list            | `A` | Start time + existing chain-count badge; don't grow it into a second card                  |
| Scheduler: agenda connector lines                 | `A` | Draws off the `depth`/`data-nested` the agenda template already emits                      |
| Badge: `size` + icon slot                         | `A` | See #5                                                                                     |
| Accordion: border/label transition                | `A` | Precedent in `button.component.css`'s `--_et-button-border-color`; tokens already imported |
| Progress steps: success/warning/error states      | `A` | Mirror `BANNER_TYPES`, don't invent colour language                                        |
| Colour input: hex/RGB validators                  | `A` | None exist anywhere today; the `#rrggbb` claim is a doc comment only                       |
| Grid: assert breakpoint coverage in the dev check | `A` | Cheap half of the "nothing ties layout keys to breakpoints" item                           |
| Filter overlay story: demo dressing               | `A` | Story file only - lorem filler, inline styles, toggle-buttons standing in for fields       |
| Auth: `shouldAutoLogin` predicate                 | `A` | Alongside `excludeRoutes`, so consumers stop prefix-matching substrings                    |

### M - real work, mostly consolidation

| Item                                               | Tag     | Note                                                                                                    |
| -------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Selection card dedupe                              | `C`     | See #1                                                                                                  |
| Form field suffix unification                      | `C`     | See #2                                                                                                  |
| Slider + rating → `dragGestureFrom`                | `C`     | See #3                                                                                                  |
| Query error on banner                              | `C`     | See #7                                                                                                  |
| Grid: thread `TData` through `GridSerializedState` | `A`     | Same family as the registration cast that already shipped                                               |
| Grid: per-breakpoint constraints (`perBreakpoint`) | `A`,`D` | Settle the early-return that makes per-item constraints silently ignored for registered types           |
| Progress steps: vertical orientation               | `A`     | Not a CSS flip - the connector is a purpose-built inline-size bar                                       |
| Progress steps: steps as links                     | `A`     | Polymorphic root (`span`/`a`/`button`) + the `:hover` rules that don't exist yet                        |
| Avatar: extract `AvatarDirective`                  | `C`     | Follow tooltip/toggletip/accordion's headless split                                                     |
| Avatar group: `maxVisible` + "+N"                  | `A`     | No "+N" pattern exists anywhere to copy - new surface                                                   |
| Description list: `variant`                        | `A`     | Empty class today, five CSS properties; any variant is new surface                                      |
| Scheduler: colour palette via DI token             | `A`,`D` | Parallel to `injectColorThemes`; keep free text as fallback                                             |
| Scheduler: infinite agenda                         | `D`     | Lands as a documented `paged-query-stack` consumer pattern - paging belongs to the query, not scheduler |

### L - projects, not tickets

| Item                                         | Tag     | Note                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charts                                       | `D`,`L` | Four unknowns stacked: diverge from the `[innerHTML]` SVG precedent, a categorical palette that doesn't exist, `[etTooltip]` unverified on an SVG host, and no mechanism for animating SVG attributes. Bar charts could ship without the last one; pie/sankey can't |
| Auth: `withAuthGuard()`                      | `A`     | See #4 - unblocked, `sessionStatus` ships                                                                                                                                                                                                                           |
| Scheduler: move/resize existing appointments | `A`     | Called "the natural next feature" by the drag-to-create work                                                                                                                                                                                                        |
| Scheduler: date-time _range_ picker          | `A`     | New `forms/date-time/` surface; `DateRangeInputComponent` is date-only                                                                                                                                                                                              |
| Selection list: `variant="tile"`             | `A`,`D` | Same place as #1, so consider them together. Three open questions, chiefly whether an unchecked tile still reads as selectable                                                                                                                                      |
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

#1 and the tile are the same edit in the same file - decide the tile's open questions before
starting the dedupe, or accept doing that stylesheet twice. Everything in the `S` table is
independent of everything else and can be picked off in any order.
