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
>
> **Both devtools `B` items** shipped 2026-08-07 and their rows are gone from the `S` table.
> **Execute throws ET003** turned out to be reachable only through `silenceMissingWithArgsFeatureError`,
> since the lib refuses a function-route query without `withArgs`; the fix covers all four parts the
> section listed, not just the args replay. **"Forget" with the Gone chip off** was worse than the
> gating slip it was filed as - the button cleared the whole registry, every client and past any
> search - so `clearQueryDevtoolsTombstones()` now takes ids and the button drops only what is listed.
>
> **The args explorer's `HttpHeaders`** (`B`,`D`) shipped 2026-08-07 too, both scope calls settled by
> the user: the explorer learned non-plain objects generally, and **Args** stays raw - no merged
> `resolveHeaders()` node. The editor half was bigger than the section implied, because most of those
> values cannot survive JSON at all; they are now preserved rather than replayed as `{}`. Every
> remaining query devtools item was `A` as of that date - two `B`s were reported on 2026-08-10 and
> are in the `S` table.
>
> **Shipped 2026-08-09.** Both remaining auth `S` items, and with them the "logged out after being
> idle" shortlist entry (was #1). The diagnosis it asked for turned up something larger than the
> re-arm hole it described: the proactive refresh **had never fired**, because the scheduler mapped
> its due signal with `tap` and gated on `timer`'s `0`. Every session was living off the reactive 401
> path, which is exactly how a refresh token gets spent long after the server rotated it. The re-arm
> shipped on top of the fix, and a synced logout now carries its cause, so a tab no longer reports
> `otherTab` for a session that expired elsewhere. What is left of #1 is the **visibility** half - no
> `visibilitychange` re-check, and `refresh-requested` is still fire-and-forget - plus the per-tab
> inactivity timer, which stays in the `M` table.
>
> **Query error rebuilt on banner** (was #1) shipped 2026-08-09. It is now an `et-banner` of
> `type="error"`; the duplicated `color-mix` card and the whole `injectErrorTheme()`/`ProvideColorDirective`
> wiring are gone from query error, since `type="error"` already does both. Banner gained the two slots the
> composition needed (`[etBannerHeading]`, `[etBannerBody]`) plus a `liveRegion` override, because the host
> keeps `role="alert"` and a live region inside one announces twice. Two user calls: the panel **adopts
> banner's row layout** instead of banner growing a stacked orientation, and the `--et-query-error-*` tokens
> are **retired** for `--et-banner-*` rather than aliased - so this is a `major`. **Selection list
> `variant="tile"` is now #1**, still blocked on its three design questions.
>
> **Progress steps: outcome states** shipped 2026-08-10 (an `S` row). `state` grows by `success`,
> `warning` and `error` - each a _resolved_ state that fills its marker and the connector after it,
> carries its own icon so the outcome never rests on colour alone, and forces the app's matching
> semantic theme onto the step via `ProvideColorDirective`, exactly as banner does per `type`. The
> existing accent rules were reused as-is: they already read `--et-theme-color-primary-solid`, which
> now resolves inside the step's own scope. Labels take `--et-theme-color-ink-solid`. Only the theme a
> rendered step uses is injected, so a flow that never fails still needs no `type: 'error'` theme.
>
> **Accordion: the header's hover response** shipped 2026-08-10 (an `S` row). The tint stays; the
> bottom hairline and the hint/chevron now move with it, on a new `--et-accordion-color-duration`.
> Two things went slightly beyond the row: hover states are behind `@media (hover: hover)` now (they
> used to stick after a tap), and reduced-motion drops only the chevron's rotation, not its fade.
>
> **Colour input: hex/RGB validators** shipped 2026-08-10 (an `S` row). `hexColor()` / `rgbColor()`,
> strict `#rrggbb` by default with shorthand and alpha as opt-ins, both passing on a blank value so
> `required` keeps sole ownership of emptiness. The **contrast validator the section also mentions is
> still unbuilt** - it needs a cross-field read nothing in `libs/forms` does yet.
>
> **Auth: `shouldAutoLogin`** shipped 2026-08-10 (an `S` row), and with it **every auth item in this
> file is closed**. It sits next to `excludeRoutes` as an independent veto - either refusing skips
> auto-login - so a predicate can never re-enable an excluded route.
>
> **Query devtools: overrides survive a reload** shipped 2026-08-10 (an `S` row). A panel-wide
> **Keep across reloads** toggle writes the armed op lists to `sessionStorage` and the registry
> replays them as each query registers - so the replay happens whether or not the panel is ever
> opened. Turning it on captures what is armed at that moment. A reload that re-armed anything opens
> with a red bar saying what came back and what **matched no query**, with Review and Drop all;
> armed faults deliberately stay excluded, which is what the Faults tab already promised.
>
> **Query devtools: copy a key or a path** shipped 2026-08-10 (an `S` row). The `menu vs
modifier-click` question was settled by the user in favour of the **menu**: `⧉` still copies the
> value in one click and a caret beside it offers Value / Key / Path / `"key": value`. The path is
> the History diff's format, now shared from `query-devtools-diff.ts` rather than reimplemented, and
> the tick names which payload landed. Rows with no address of their own - the explorer root, a
> folded slice - keep the bare `⧉`; an array element gets the caret but only Value and Path.
>
> **Query devtools: float the panel in-page** shipped 2026-08-10 (an `M` row). `dock` gains `float`,
> with a persisted rect; the one dock button cycles bottom → right → float. On the user's prompt it is
> built on the **stream pip's primitives** rather than its own pointer code - `[etDragHandle]` plus
> `<et-resize-handles>` from `@ethlete/core`, so a float resizes from all eight edges. One pure
> `resizedFloatRect`/`clampFloatRect` pair serves the drag, the window resize _and_ the restore of a
> rect stored on a bigger screen. The pip's **park-off-an-edge** behaviour was ported on top: shove the
> panel more than halfway off the left, right or bottom and it stays there with a ~44px grab strip;
> click the title bar to bring it back. North is never a parking edge. The blocked pop-up the section
> filed alongside it now raises a notice with a one-click **Float instead**.
>
> **Query devtools: nest the Queries list by path** shipped 2026-08-10 (an `M` row). The **Web Locks
> inspector** (`A`,`D`) was, at that point, the only query devtools item left open. An opt-in **⑂ tree** toggle,
> flat still the default. The row's warning was right and only showed up once it was driven in the
> story: the first build headed every route, so a node nothing branches off now gets **no folder row
> at all**, and single-child chains compress into one. Folders store collapsed rather than expanded,
> because a tree that opens closed answers nothing.
>
> **A layout menu, with left and top docks**, shipped the same day (user-raised): the dock-cycle and
> Pop out buttons are one menu naming where the panel is, and `dock` grows `left` and `top`. It is a
> plain positioned list rather than an `et-menu`, for the same reason the tab overflow menu is - an
> overlay renders into the app's document, and the panel can be in the pop-up's. Two bugs the headless
> runs missed: `<et-resize-handles>` swaps to 20/28px bands on `any-pointer: coarse` and blanketed the
> float's title bar, and the header strips' `overflow-x: auto` clipped the dropdown. Both fixed - see
> `component-improvements.md`; the second one also fixes the tab overflow menu.
>
> **The tile stays #1 and stays parked** - the user declined its design questions on 2026-08-09
> rather than settling them, so do not re-ask unprompted.

1. **Selection list `variant="tile"`** - `M` now, `A`,`D`.
   Was an `L`; the selection-card dedupe turned it into a single edit on one shared sheet. Settle
   its three open questions first - chiefly whether an unchecked tile still reads as selectable -
   because they are design calls, not code.

## Everything else, by effort

### S - small, additive, low risk

| Item                                              | Tag     | Note                                                                                                                                                                                                             |
| ------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dropzone: removing a prefilled value deletes it   | `B`,`D` | Existing and uploaded entries hit the same `delete`; apps patch `@internal` `executeDelete` to stop it. Settle the default                                                                                       |
| Scheduler: richer sub-appointment list            | `A`     | Start time + existing chain-count badge; don't grow it into a second card                                                                                                                                        |
| Scheduler: agenda connector lines                 | `A`     | Draws off the `depth`/`data-nested` the agenda template already emits                                                                                                                                            |
| Dropzone: reveal the preview on hover             | `A`     | CSS only, but keep the name bar while uploading or on error - it holds the progress and the reason                                                                                                               |
| Grid: assert breakpoint coverage in the dev check | `A`     | Cheap half of the "nothing ties layout keys to breakpoints" item                                                                                                                                                 |
| Filter overlay story: demo dressing               | `A`     | Story file only - lorem filler, inline styles, toggle-buttons standing in for fields                                                                                                                             |
| Query: retire `CLEAR_QUERY_ARGS`                  | `D`     | Make `null` mean park; deprecated alias keeps every call site compiling. Nothing uses keep-previous                                                                                                              |
| Query devtools: paste gaps around overrides       | `A`,`D` | User-raised 2026-08-10. Copy of a subtree and paste onto a node **already ship** - the gaps are the `readText()`-only clipboard path, the kind guard that refuses a shape change, and no paste-as-new-array-item |
| Query devtools: copy an armed override set        | `A`     | The other reading of the same ask, and the unbuilt one. `QueryDevtoolsOverrideEntry[]` is already the JSON the persistence store writes; import is `arm()` in a loop, and stale paths already report themselves  |

### M - real work, mostly consolidation

| Item                                               | Tag     | Note                                                                                                                                                                                                       |
| -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth: inactivity is per-tab, the logout is shared  | `B`,`D` | An idle tab logs out the active one; `resetTimer()` moves the countdown but not the timer. Idleness has to be session-wide                                                                                 |
| Grid: thread `TData` through `GridSerializedState` | `A`     | Same family as the registration cast that already shipped                                                                                                                                                  |
| Grid: per-breakpoint constraints (`perBreakpoint`) | `A`,`D` | Settle the early-return that makes per-item constraints silently ignored for registered types                                                                                                              |
| Progress steps: vertical orientation               | `A`     | Not a CSS flip - the connector is a purpose-built inline-size bar                                                                                                                                          |
| Progress steps: steps as links                     | `A`     | Polymorphic root (`span`/`a`/`button`) + the `:hover` rules that don't exist yet                                                                                                                           |
| Avatar: extract `AvatarDirective`                  | `C`     | Follow tooltip/toggletip/accordion's headless split                                                                                                                                                        |
| Avatar group: `maxVisible` + "+N"                  | `A`     | No "+N" pattern exists anywhere to copy - new surface                                                                                                                                                      |
| Description list: `variant`                        | `A`     | Empty class today, five CSS properties; any variant is new surface                                                                                                                                         |
| Scheduler: colour palette via DI token             | `A`,`D` | Parallel to `injectColorThemes`; keep free text as fallback                                                                                                                                                |
| Scheduler: infinite agenda                         | `D`     | Lands as a documented `paged-query-stack` consumer pattern - paging belongs to the query, not scheduler                                                                                                    |
| Selection list: `variant="tile"`                   | `A`,`D` | See #1 - one edit on the shipped selection-card sheet, once the three design questions are settled                                                                                                         |
| Segmented `variant="tabs"` doesn't match tabs      | `C`,`D` | Underline size, baseline rule, swapped accent tokens, half the block padding, hover fills an unchecked segment. Wants shared tokens                                                                        |
| Query: long polling                                | `A`,`D` | A completion-driven chain, not an interval - `withPolling` can't express it. Needs next-args-from-last-response, which is the reusable part                                                                |
| Query devtools: Web Locks inspector                | `A`,`D` | Origin-wide, so it sees other tabs - but `LockInfo` has no tab identity and Web Locks has no change event. The `isLeader` chip shipped                                                                     |
| Number input: drag-to-scrub + step modifiers       | `A`,`D` | User-raised 2026-08-10. One `stepBy(direction, multiplier)` serves both halves. Settle the multiplier vocabulary once, and which surface the drag lives on - the stepper buttons already own `pointerdown` |

### L - projects, not tickets

| Item                                         | Tag     | Note                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charts                                       | `D`,`L` | Four unknowns stacked: diverge from the `[innerHTML]` SVG precedent, a categorical palette that doesn't exist, `[etTooltip]` unverified on an SVG host, and no mechanism for animating SVG attributes. Bar charts could ship without the last one; pie/sankey can't                      |
| Scheduler: move/resize existing appointments | `A`     | Called "the natural next feature" by the drag-to-create work                                                                                                                                                                                                                             |
| Scheduler: date-time _range_ picker          | `A`     | New `forms/date-time/` surface; `DateRangeInputComponent` is date-only                                                                                                                                                                                                                   |
| Colour input: custom picker                  | `A`     | Replaces the native input behind the same directive contract                                                                                                                                                                                                                             |
| Command palette                              | `A`,`D` | Merged item. Leans on the existing overlay + menu, so cheaper than it looks - but settle the scope before starting, the backlog flags scope creep as the real risk                                                                                                                       |
| Stat tile                                    | `A`     | Merged item, marked low / opportunistic. Note the `dataviz` guidance covers stat tiles, so the design language exists even though the component doesn't                                                                                                                                  |
| Test harnesses                               | `D`     | Merged item. `forms/testing/` has one utility and every spec talks to the DOM directly; CDK-`ComponentHarness`-style drivers are the question. Explicitly "not urgent" - revisit as more controls land                                                                                   |
| Forms: a `warning` validity state            | `A`,`D` | User-raised 2026-08-10. Colour language exists; the open call is whether a warning is a signal, a validator severity, or presentation-only - and how it shares the error slot. Must never block submit                                                                                   |
| Forms: time-zone handling / local-time UX    | `D`     | User-raised 2026-08-10. Wants an input's date/time also shown in local time, with the user's own caveat that it must not get confusing. Settle what the control's value _is_ (zoned instant vs wall clock + zone) before any UI. Scope date-time, range and scheduler together           |
| Query devtools: mock designer + API export   | `A`,`D` | User-raised 2026-08-10. Route-level stubs at the `sendWithFaults` hook, authored with the override menu's existing generator vocabulary, exported as a spec. Settle the export format first - it decides what the designer must capture. Not MSW: the value is seeding from the registry |

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

One chain, added 2026-08-10: **About → Settings → mock designer.** About and Settings both
**shipped** that day, so only the designer is left - and it inherits `queryDevtoolsSettings()`, which
is where a mock library's storage scope belongs. Do not add a fourth hardcoded key: the picker, the
migration between stores and the "IndexedDB cannot answer a synchronous read" note are all there.
