# Opportunities: improvements & new additions

Research done 2026-07-23 (source-verified scans of `libs/components` +
`libs/core`). Written alongside the `plans/cdk-port/` set (all shipped and since
deleted, along with the cdk deprecation roadmap it fed - every cdk export now
carries an `@deprecated` tag naming its successor) - nothing here overlapped
those plans. Unprioritized backlog; pick items into real plans as needed.

> A second research pass (2026-07-30) covering gaps _inside_ existing
> components - touch/gesture, RTL/i18n/a11y consistency, per-domain feature
> gaps - lives in `components-research-findings.md`. Its twelve implementation
> plans have all shipped; that file keeps the evidence, the unplanned backlog and
> what the work deferred.

## New components (none exist today; verified)

High value (table-stakes for app teams):

| Candidate                 | Notes                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Banner / inline alert** | `notification` is transient toast/snackbar only; no static dismissible page/section message (info/warning/error/success). Semantic colors via theme types. |
| **Avatar (+ group)**      | User/entity representation for shells, member lists, comments.                                                                                             |
| **Card**                  | Generic content container; every dashboard team reaches for it.                                                                                            |
| **Badge**                 | Non-interactive status/count indicator - `chip` (interactive/removable) currently does double duty.                                                        |
| **Empty state**           | Icon/title/description/action slot. Grid + cascader hand-roll "no results" today; table/pagination plans will need it too - build once.                    |

Medium: **Divider** (tabs/RTE/split-button/sidebar each reinvent it - cheap
extraction), **Description list** (`dl/dt/dd` detail views; note naming clash
with form-field's `et-description`), **Copy-to-clipboard button**
(`copyToClipboard()` already in core; query-devtools hand-rolls the
icon-swap-feedback pattern twice), **Toolbar** (generalize - RTE already
implements the full ARIA toolbar pattern, grid has `et-grid-item-toolbar`),
**Stepper/progress-steps** (wizard indicator; ties to the parked form-wizard
idea; distinct from the number-input stepper), **Tree view** (cascader's
internal `cascader-tree.ts` is not exposed generically).

Low / opportunistic: stat tile, timeline, kbd, command palette (leans on
existing overlay+menu so cheaper than it looks, but scope-creep risk),
back-to-top (covered by `10-filter.md` Layer 1's generic floating trigger).

Already covered - don't rebuild: date-range picker, segmented control,
loaders, popover-as-API (overlay), rating/switch.

## Platform modernization - team decisions recorded 2026-07-23

Repo has no browserslist config → implicit evergreen baseline. Already
adopted (don't re-plan): `:has()` widely, `@starting-style` in rating +
otp-input, `container-type` in stream/pip.

- **Animated lifecycle stays. Decided - do not plan a replacement.**
  `animatable.directive.ts` + `animated-lifecycle.directive.ts` took a long
  time to fine-tune (interrupts, batching, nested trees, forced-instant
  states); `@starting-style`/`allow-discrete` cannot replace all of it. New
  simple show/hide cases may use `@starting-style` directly (precedent:
  rating, otp-input), but the directive pair is not a migration target.
- **`<dialog>`/top-layer: rejected.** The native top layer breaks consumer
  apps that rely on z-index layering to push their own elements above modals
  (magic z-indexes over `z-index: 1000` work today; nothing beats the top
  layer). The overlay system keeps its portal + z-index approach. This
  reasoning applies equally to the **Popover API** for tooltip/toggletip/menu
  - same top-layer semantics, same rejection.
- **View Transitions: agreed in principle, not yet baseline** (Firefox lacks
  same-document VT). Highest-value target when it lands:
  `overlay/strategies/fullscreen-animation.ts` (733 lines of origin→viewport
  transform math + trigger cloning; VT snapshots pixels, which may also
  sidestep the Angular style-unload constraint that forced cloning - see the
  no-clone-animations rule). Also `flip-animation.ts` (tab underline,
  segmented button). **Re-check browser support before any future planning.**
- **Chrome-only for now - re-scan when Firefox/Safari ship**: CSS anchor
  positioning (would shrink `overlay-position.ts`'s floating-ui usage - do
  NOT swap yet), `interpolate-size`/`calc-size` (would replace
  `animated-block-size.ts`; a `@supports` progressive-enhancement fast path
  is possible), `field-sizing: content` (would delete
  `textarea-autosize.ts` + ~70–90 lines of `textarea.directive.ts`).

## DX / tooling

- **Component scaffolding generator** (`@ethlete/components`): only an
  `icons` generator exists. The three-tier architecture (folder layout,
  headless+default split, stories, `@layer components` CSS, error codes,
  self-registration) is mechanical - a `component`/`directive` generator
  would pay for itself quickly.
- **Test harnesses**: `forms/testing/` has exactly one utility (the
  `mixed-state-contract`). No CDK-`ComponentHarness`-style drivers - every
  spec talks to the DOM directly. Worth considering as more controls land;
  not urgent.

## Next major - removal checklist

Nothing else tracks this, so it lives here until a real changelog/migration doc
exists.

- **`core/seo.directive.ts` - remove.** Already `@deprecated`, and the only real
  SSR crash risk left in `core`: bare `document` access at lines 98–154, no
  `DOCUMENT` injection, no guard. Deliberately **not** fixed in place
  (`components-research-findings.md` §1) - patching a directive that
  is scheduled for deletion is wasted work. The other `core` global-access
  stragglers (`scrolling/scrollable.ts`, `animations/animation-utils.ts`) were
  guarded instead, since they stay.

## Tech debt notes (codebase is very clean - 3 TODOs total)

- `bracket/drawing/grid/core/bracket-grid.ts:86` - "The problem is here
  somewhere" above a layout offset calc: the only unresolved-bug marker in
  the lib; worth a focused look.
- `bracket/index.ts:1` - narrow the public surface: `./core` and `./linked` still
  re-export internal engine builders next to the public data types. The TODO waited
  on the default cards, which have since shipped, so it is actionable now. (The
  bracket docs' own TODOs are gone.)
- Docs coverage: complete - every public domain has a docs page.
