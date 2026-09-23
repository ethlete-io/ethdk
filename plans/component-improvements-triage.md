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

Also done (2026-08-21): the internal form test drivers, in five passes - **finished**. Every form
control now drives its spec through a driver. `libs/components/src/lib/testing/` holds the shared
core - `driver-core.ts`, the `control-driver.ts` base, and the two families built on it
(`overlay-control-driver.ts`, `field-control-driver.ts`).
`libs/components/src/lib/forms/testing/` holds the per-control drivers: `select-driver.ts`,
`cascader-driver.ts`, `date-picker-driver.ts`, `number-input-driver.ts`,
`password-input-driver.ts`, `tag-input-driver.ts`, `color-input-driver.ts`, `checkbox-driver.ts`,
`selection-list-driver.ts`, `slider-driver.ts`, `switch-driver.ts`, `rating-driver.ts`,
`textarea-driver.ts`, `phone-input-driver.ts`, `otp-input-driver.ts` and `dropzone-driver.ts`.
Thirty specs are converted: select (including the option groups and the data-driven options),
cascader, all eight date-time specs, the text input, number input, password input, tag input and
colour input, the checkbox, the selection list (group, option and the checkbox-group select-all),
both sliders, the switch, the rating, the textarea, the phone input, the OTP input and the
dropzone (component and directive). Every converted control went to zero direct DOM sites; the
plain input needs no per-control driver and uses `mountFieldControl` with `InputDirective`
directly. The forms specs are down from 383 direct DOM sites to 162. The `testing/` folder is
excluded from the lib build, so nothing here ships.

What is left is deliberate, not pending: `rich-text-editor-dom.spec.ts` (48 sites) tests DOM
utilities, so the DOM is the subject there, and the rest are structural one-line assertions - the
form-field suffix slot (12), `focus-first-invalid-field.spec.ts` (10), the label directive (9) -
which a driver would not shorten.

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

1. For new component work, prefer stat tile when a bounded addition is wanted. Start charts only
   when its palette, SVG host and animation questions are the work the team intends to take on. The
   `<et-scrollbar>` retro-fit is done: the menu, the cascader panel, the time picker columns and the
   docked rich text editor toolbar all carry one.
2. Treat the View Transition replacement as a separate compatibility project, not incidental overlay
   cleanup.

## Spike: Fullscreen View Transitions (2026-09-23)

Scope: `libs/components/src/lib/overlay/strategies/fullscreen-animation.ts` (770 lines) and `libs/core/src/lib/animations/flip-animation.ts` (253 lines). Probed in headless Chromium 149 and Firefox 151 with a throwaway page, since deleted. WebKit did not launch here.

What the fullscreen animation does today:

- It deep-clones the trigger into an `OverlayOriginCloneComponent` on `body` (`fullscreen-animation.ts:335-364`), at `z-index: 999999` (`overlay-origin-clone.component.css:5`).
- The clone scales up to the viewport while the container scales down from the origin rect. Both read CSS variables from `calculateViewportTransforms` (`:116-155`, `:172-223`). The CSS morphs `border-radius` too (`full-screen-dialog-styles.component.css:5-9`).
- The origin is hidden with a ref count, so several overlays can share one trigger (`:69-97`, `:366-397`).
- On close it re-measures the origin, so it lands where the trigger is now. It builds a clone if none exists (`:569-598`).
- Interruption: a close while the clone is `init` falls back to the reduced animation (`:602-628`). A close while `entering` swaps to the leave variables and the CSS transition reverses from where it is (`:630-650`). Cleanup waits for `left`, with a 500 ms timeout (`:720-751`).
- The reduced path (reduced motion, viewport of 1000px or wider, no origin) is a 0.75 scale from a transform-origin (`:157-170`, `:225-256`).
- Consumers: only `full-screen.strategy.ts:64-110`, through `presets.ts:29,50` (stories) and `scheduler-edit-surface.component.ts:193,231`.

What View Transitions can replace:

- Clone plus origin-to-viewport math: yes. A shared `view-transition-name` on the trigger and then the container morphs position and size natively. The old snapshot is static, the new one is live.
- Border-radius morph: not built in. It needs custom keyframes on `::view-transition-old/new`.
- Reduced motion: not automatic. It needs a `prefers-reduced-motion` rule. The 0.75-scale path needs no snapshot and can stay plain CSS.
- Top-layer and z-index: fine. A `showModal` dialog with a name transitioned in both engines. The pseudo tree paints above everything, so the `999999` clone goes away.

Gaps, measured:

- Interruption does not reverse. Closing mid-enter restarted the group from the full-viewport rect (keyframe `matrix(1,0,0,1,0,0)`, 1280x720), not from the mid-flight rect (`40,300`, 120x40). The overlay jumps. A fix reads the pseudo's computed transform and writes its own keyframes, which rebuilds the math we wanted to delete.
- One transition per document. A second `startViewTransition` skips the first, so any router `withViewTransitions` or other component transition will cut ours off. The repo calls `startViewTransition` nowhere today.
- Input is blocked. During a transition `elementFromPoint` returned `<html>`, so real clicks on the page and the overlay are swallowed for the 400 ms. Today the overlay takes input while it animates.
- Names must be unique. A duplicate `view-transition-name` aborts the transition, so the shared-trigger ref count becomes per-open generated names.
- The update callback must render the overlay synchronously (`appRef.tick()`) before the new snapshot is taken.
- Support: document transitions work in Chromium, Firefox 144+ and Safari 18+. Element-scoped `element.startViewTransition` exists in Chromium only (absent in Firefox 151).

`flip-animation.ts` consumers (segmented button, dropzone, stream manager, tab underline) run small, concurrent, local movements while the user interacts. A global document transition would block input and the movements would skip each other. That is a no-go until scoped transitions ship in Firefox and Safari.

Recommendation: go with conditions for the fullscreen enter/leave only. The conditions: accept or custom-key the mid-flight reversal, own a single transition coordinator in core, and accept input blocked for 400 ms. Effort: about 4-6 days, including e2e coverage of open/close/interrupt on desktop and touch. It would remove roughly 500 of the 770 lines. No-go for `flip-animation.ts`.
