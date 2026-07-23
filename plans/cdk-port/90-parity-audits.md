# 90 — Parity audits, cdk utils destinations, deprecation roadmap

**Status: audits done 2026-07-23** (source-verified). Remaining work items are
listed per section.

## Radio — parity: yes, two cosmetic/semantic gaps

`libs/components/src/lib/forms/selection-list/radio-group` already ships
`et-radio-group`/`et-radio` with a classic round-radio look (`.et-radio-circle`,
animated dot), `role="radiogroup"`, signal-forms binding. (`choice-field` is
unrelated — it's a label wrapper for checkbox/switch.) Gaps vs cdk:

1. **No native `<input type="radio">`** — components' radio is ARIA-simulated
   (`role="radio"` + roving tabindex). Losing native form submission/autofill
   is a deliberate architecture trait of the selection-list system; **decision
   needed**: accept (recommended — consistent with the rest of the lib) or add
   a native-input rendering mode. Record the decision.
2. **No card preset** (cdk's `et-radio-card-field`: full-row clickable card).
   Work item: add a card variant/preset to the components radio (or document
   the CSS recipe). Small.

## Segmented button — one real gap

`forms/selection-list/segmented-button-group` exists and is more evolved
(FLIP animation, roving tabindex, sizes, readonly/mixed states) **except**:
cdk's `renderAs: 'tabs'` mode (underline indicator instead of filled pill) has
no equivalent. Work item: add a tabs-style indicator mode — but first check
whether the `tabs` domain in components already covers those use cases;
if consumers used cdk's segmented-`tabs` mode as actual tabs, the answer may
be "use `et-tabs`" + a docs note rather than a new mode.

## Icons — obsolete: fully superseded

components' icon system is a strict superset: same mechanism (`[etIcon]`,
`provideIcons()`), 38 built-in icons including both cdk icons (`et-chevron`,
`et-times` — same SVG paths), plus typed name/variant registries, app-wide
`provideIconOverrides()`, structured error codes. No migration work beyond the
import swap consumers do when leaving cdk.

## cdk `utils/` — destinations

All four are public `@ethlete/cdk` API (docs: `apps/docs/cdk/utilities.md`),
so they stay in cdk until cdk itself is sunset; this is about successors:

| util                                        | Verdict                                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `swipe.ts`                                  | **Superseded** — `libs/core/src/lib/utils/swipe.ts` is a line-for-line copy and components' overlay drag-to-dismiss already imports from `@ethlete/core`. No action.                                                      |
| `navigation-dismiss-checker.ts`             | **Superseded** — core's `unsaved-changes` family (`createUnsavedChangesTracker`/`createUnsavedChangesGuard`, signal-forms aware) + components' `createOverlayUnsavedChangesGuard`. No action.                             |
| `floating-ui.ts` (`FLOATING_UI_PLACEMENTS`) | Trivial storybook-only constant, no internal consumers. No successor needed.                                                                                                                                              |
| `router.ts` (`injectRouterNavigationState`) | **Orphan — decision needed**: no equivalent anywhere. Either port verbatim to `@ethlete/core` (it's framework-primitive-shaped) or declare "won't migrate" before cdk sunset. Zero in-repo usages — check consuming apps. |

## cdk deprecation roadmap (once ports land)

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
