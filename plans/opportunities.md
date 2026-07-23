# Opportunities: improvements & new additions

Research done 2026-07-23 (source-verified scans of `libs/components` +
`libs/core`). Complements `plans/cdk-port/` — nothing here overlaps those
plans. Unprioritized backlog; pick items into real plans as needed.

## New components (none exist today; verified)

High value (table-stakes for app teams):

| Candidate                 | Notes                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Banner / inline alert** | `notification` is transient toast/snackbar only; no static dismissible page/section message (info/warning/error/success). Semantic colors via theme types. |
| **Avatar (+ group)**      | User/entity representation for shells, member lists, comments.                                                                                             |
| **Card**                  | Generic content container; every dashboard team reaches for it.                                                                                            |
| **Badge**                 | Non-interactive status/count indicator — `chip` (interactive/removable) currently does double duty.                                                        |
| **Empty state**           | Icon/title/description/action slot. Grid + cascader hand-roll "no results" today; table/pagination plans will need it too — build once.                    |

Medium: **Divider** (tabs/RTE/split-button/sidebar each reinvent it — cheap
extraction), **Description list** (`dl/dt/dd` detail views; note naming clash
with form-field's `et-description`), **Copy-to-clipboard button**
(`copyToClipboard()` already in core; query-devtools hand-rolls the
icon-swap-feedback pattern twice), **Toolbar** (generalize — RTE already
implements the full ARIA toolbar pattern, grid has `et-grid-item-toolbar`),
**Stepper/progress-steps** (wizard indicator; ties to the parked form-wizard
idea; distinct from the number-input stepper), **Tree view** (cascader's
internal `cascader-tree.ts` is not exposed generically).

Low / opportunistic: stat tile, timeline, kbd, command palette (leans on
existing overlay+menu so cheaper than it looks, but scope-creep risk),
back-to-top (covered by `10-filter.md` Layer 1's generic floating trigger).

Already covered — don't rebuild: date-range picker, segmented control,
loaders, popover-as-API (overlay), rating/switch.

## Platform modernization (ranked by win ÷ support-risk)

Repo has no browserslist config → implicit evergreen baseline. Already
adopted (don't re-plan): `:has()` widely, `@starting-style` in rating +
otp-input, `container-type` in stream/pip.

1. **Enter/leave animation state machine → `@starting-style` +
   `transition-behavior: allow-discrete`** — cross-browser today.
   `libs/core/src/lib/animations/animatable.directive.ts` (147) +
   `animated-lifecycle.directive.ts` (464) hand-roll from/active/to/done class
   choreography, `forceReflow()`, interrupt bookkeeping — consumed by ~24 CSS
   files. CSS transitions interrupt-and-reverse natively. **Load-bearing:
   spike on one low-stakes consumer (toggletip) first**; full migration is a
   multi-week effort with regression risk, not a quick win.
2. **`<dialog>`/`showModal()` for modal overlay kinds** — cross-browser.
   Deletes manual z-index stacking (`overlay-runtime.ts:69`), most of the
   hand-rolled focus trap (`overlay-focus.ts`, ~117 lines) and backdrop
   handling for center/global/fullscreen strategies. Partial migration only —
   anchored/non-modal kinds keep the current portal; scroll-blocker
   (`overlay-scroll-blocker.ts`) still needed for those.
3. **Fullscreen clone animation → View Transitions** —
   `overlay/strategies/fullscreen-animation.ts` (733 lines, biggest single
   file): manual origin-rect→viewport transform math + trigger cloning.
   Textbook `document.startViewTransition()`; VT snapshots pixels, which may
   also sidestep the Angular style-unload constraint that forced cloning.
   **Blocked: Firefox lacks same-document View Transitions** — track, don't
   build. Same blocker for `flip-animation.ts` (tab underline, segmented
   button) — smaller, lower priority.
4. **Chrome-only for now — re-scan when Firefox/Safari ship**: CSS anchor
   positioning (would shrink `overlay-position.ts`'s floating-ui usage — do
   NOT swap yet), `interpolate-size`/`calc-size` (would replace
   `animated-block-size.ts`; a `@supports` progressive-enhancement fast path
   is possible), `field-sizing: content` (would delete
   `textarea-autosize.ts` + ~70–90 lines of `textarea.directive.ts`).
5. **Popover API for tooltip/toggletip/menu**: small win (top-layer replaces
   the z-index constant; positioning stays floating-ui) — do opportunistically.

## DX / tooling

- **Component scaffolding generator** (`@ethlete/components`): only an
  `icons` generator exists. The three-tier architecture (folder layout,
  headless+default split, stories, `@layer components` CSS, error codes,
  self-registration) is mechanical — a `component`/`directive` generator
  would pay for itself quickly, and directly helps the cdk-port work.
- **Test harnesses**: `forms/testing/` has exactly one utility (the
  `mixed-state-contract`). No CDK-`ComponentHarness`-style drivers — every
  spec talks to the DOM directly. Worth considering as more controls land;
  not urgent.

## Tech debt notes (codebase is very clean — 3 TODOs total)

- `bracket/drawing/grid/core/bracket-grid.ts:86` — "The problem is here
  somewhere" above a layout offset calc: the only unresolved-bug marker in
  the lib; worth a focused look.
- `bracket/index.ts:1` + two TODOs in `apps/docs/components/bracket.md` —
  known bracket WIP (default cards + their a11y), already tracked.
- Docs coverage: complete — every public domain has a docs page.
