# 90 — Parity audits, cdk utils destinations, deprecation roadmap

**Status: audits done 2026-07-23; work items closed out 2026-07-30.** Every
decision below is now recorded, and the three implementable gaps shipped. The one
remaining open item is the cdk deprecation roadmap, deliberately deferred (see the
last section).

## Radio — parity: yes, two cosmetic/semantic gaps

`libs/components/src/lib/forms/selection-list/radio-group` already ships
`et-radio-group`/`et-radio` with a classic round-radio look (`.et-radio-circle`,
animated dot), `role="radiogroup"`, signal-forms binding. (`choice-field` is
unrelated — it's a label wrapper for checkbox/switch.) Gaps vs cdk:

1. **No native `<input type="radio">`** — components' radio is ARIA-simulated
   (`role="radio"` + roving tabindex). **DECIDED 2026-07-30: accepted, no native
   mode.** It is a deliberate trait of the whole selection-list system, and adding
   a second rendering mode for one control would make the family inconsistent with
   itself for the sake of native form submission that a signal-forms app does not
   use. Revisit only if a consumer needs autofill or a non-JS form post.
2. **No card preset** — **DONE 2026-07-30.** `et-radio` takes
   `variant="card"` (`RADIO_VARIANTS`): full-width clickable panel, label leading
   and control trailing, room for an `et-description`, with the selection on the
   border as well as in the dot. Tokens `--et-radio-card-padding` /
   `-border-radius` / `-border-width`.
   - cdk's version hardcoded `background-color: #2e2e2e`; this one follows the
     surface, and the checked state follows the colour theme.
   - **Also added for checkbox/switch**, at the team's request. It belongs on
     `et-choice-field` rather than on `et-checkbox`, because `et-checkbox` renders
     only the box — the wrapper holds the label — so one variant covers both
     controls. The wrapper reads the control's state with `:has()`.
   - Both card rules exclude the checked state from their hover hint. Without
     that the 40%-opacity hover border out-specifies the full-strength selected
     one, so hovering the chosen card made it look less chosen (caught by driving
     the story headlessly, not by reading the CSS).

## Segmented button — one real gap → DONE 2026-07-30

`forms/selection-list/segmented-button-group` exists and is more evolved
(FLIP animation, roving tabindex, sizes, readonly/mixed states) **except**:
cdk's `renderAs: 'tabs'` mode (underline indicator instead of filled pill) had
no equivalent.

**Shipped** as `variant="tabs"` (`SEGMENTED_BUTTON_GROUP_VARIANTS`) — the
underline reuses the very element the FLIP animation moves, so the selection still
slides between segments and only its shape changes; the group drops the tonal
track for a baseline rule, and the checked label takes the accent instead of the
on-primary contrast colour.

The "use `et-tabs` instead" alternative was considered and is **the right answer
for the routed case**, so it is documented rather than silently unavailable: the
variant only changes how the selection is _drawn_, and the group remains a
`radiogroup` bound to a form field. The docs page says so in a warning box, and
points at `/components/tabs` for segments that are routes or linkable panels. Both
exist because both cases exist — a "list / grid" view toggle really is a filter.

## Icons — obsolete: fully superseded

components' icon system is a strict superset: same mechanism (`[etIcon]`,
`provideIcons()`), 38 built-in icons including both cdk icons (`et-chevron`,
`et-times` — same SVG paths), plus typed name/variant registries, app-wide
`provideIconOverrides()`, structured error codes. No migration work beyond the
import swap consumers do when leaving cdk.

## cdk `utils/` — destinations

All four are public `@ethlete/cdk` API (docs: `apps/docs/cdk/utilities.md`),
so they stay in cdk until cdk itself is sunset; this is about successors:

| util                                        | Verdict                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `swipe.ts`                                  | **Superseded** — `libs/core/src/lib/utils/swipe.ts` is a line-for-line copy and components' overlay drag-to-dismiss already imports from `@ethlete/core`. No action.                                                                                                                                                                                                                   |
| `navigation-dismiss-checker.ts`             | **Superseded** — core's `unsaved-changes` family (`createUnsavedChangesTracker`/`createUnsavedChangesGuard`, signal-forms aware) + components' `createOverlayUnsavedChangesGuard`. No action.                                                                                                                                                                                          |
| `floating-ui.ts` (`FLOATING_UI_PLACEMENTS`) | Trivial storybook-only constant, no internal consumers. No successor needed.                                                                                                                                                                                                                                                                                                           |
| `router.ts` (`injectRouterNavigationState`) | **DONE 2026-07-30 — ported to `@ethlete/core`** (`libs/core/src/lib/signals/router.ts`, next to the other synchronous `create*` router helpers). Kept synchronous and explicitly _not_ a signal: navigation state exists only for the duration of the navigation carrying it, so an effect would always read `null`. Documented on `/core/signal-utils` with what it is and isn't for. |

## cdk deprecation roadmap (once ports land)

**DEFERRED 2026-07-30** — every port in this plan set has now shipped, so steps 1
and 2 are unblocked, but the team chose not to run them yet. They are
consumer-visible in a way the ports are not (`@deprecated` JSDoc puts a
strikethrough through cdk APIs in every consuming app's editor), so they want to
be a deliberate, announced change rather than a tail-end commit of a port. The
plan below stands as written; it is now purely a scheduling decision.

Suggested order — each step is its own PR + changeset:

1. As each components port ships, add a deprecation note to the cdk
   counterpart's docs page (`apps/docs/cdk/*`) pointing at the new component.
2. When all ports in this plan set are shipped: mark the cdk package README +
   docs index as deprecated-for-new-code, add `@deprecated` JSDoc on the
   ported components' public APIs (breadcrumb, accordion, carousel, masonry,
   pagination, skeleton, picture, query-error, rich-filter, table, sort,
   filter, icons).
3. `contentful` depends on `cdk` — audit what it actually uses before any
   removal talk; migrating contentful off cdk is its own (unplanned) effort.
4. Actual removal/major-version drop of cdk: out of scope here; requires
   consumer-app sign-off.

## Remaining verification item from the README inventory

"Verify no cdk-only icons are still consumed" — resolved above (cdk only ever
had chevron + times, both exist in components). The README's icons row can be
considered verified.

## Close-out summary (2026-07-30)

| Item                                        | Outcome                                                    |
| ------------------------------------------- | ---------------------------------------------------------- |
| Radio: native input mode                    | Decided against — ARIA-simulated stays                     |
| Radio: card preset                          | Shipped (`variant="card"`)                                 |
| Checkbox/switch: card preset                | Shipped on `et-choice-field` (added at the team's request) |
| Segmented button: tabs mode                 | Shipped (`variant="tabs"`) + docs pointing at `et-tabs`    |
| `injectRouterNavigationState`               | Ported to `@ethlete/core`                                  |
| `swipe.ts`, `navigation-dismiss-checker.ts` | Superseded, no action (verified 2026-07-23)                |
| `floating-ui.ts`                            | No successor needed                                        |
| cdk deprecation roadmap                     | Deferred — unblocked, needs its own announced PR           |
