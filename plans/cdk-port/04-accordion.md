# 04 - Accordion

**Status: shipped 2026-07-28.** `libs/components/src/lib/accordion/` - headless
`etAccordion` / `etAccordionTrigger` / `etAccordionPanel` / `etAccordionGroup` +
`etAccordionLabel` / `etAccordionHint` / `etAccordionContent` slot templates, default
`et-accordion` / `et-accordion-group`, `ACCORDION_IMPORTS`, error codes ET36xx,
stories, docs page, changeset.

Deviations from the plan below, all deliberate:

- **Not `injectAnimatedBlockSize`.** That utility animates a _visible_ element whose
  content changes size, and it deliberately bails on zero measurements
  (`if (toBlock === 0 || toInline === 0) return`), so it cannot animate a collapse to
  nothing. The collapse is the `grid-template-rows: 0fr → 1fr` transition instead -
  already the blessed pattern in this lib (see `table-detail-styles.component.css`) -
  with cdk's delayed `visibility` flip kept (it takes the collapsed panel out of the
  a11y tree and find-in-page, which `inert` alone doesn't) and a
  `prefers-reduced-motion` block that drops the transition entirely.
- **`aria-disabled`, not native `disabled`**, on the trigger: a disabled header stays
  focusable so a screen reader can reach it and hear that it won't expand (`toggle()`
  no-ops). cdk natively disabled the button, which skips it in the tab order.
- **Heading level is an input** (`headingLevel`, default 3) rendered as
  `role="heading" + aria-level` - one element instead of six `<h*>` template branches.
- **Arrow-key navigation between headers** added on the group (`arrowKeyNavigation`,
  default on, `ArrowUp`/`ArrowDown`/`Home`/`End`), which cdk had none of.
- **Lazy content is a template, not a boolean.** Projected children are created with
  their parent regardless of any `@if` around the `<ng-content>`, so deferral has to be
  an `<ng-template etAccordionContent>`; presence of that template _is_ the opt-in. It
  stays mounted after the first expand so collapsing keeps state and has something to
  animate.
- **Missing-panel is only an error while open** (ET3602): rendering the panel
  conditionally (`@if (accordion.isOpen())`) is a legitimate headless shape, and the
  trigger drops its `aria-controls` while the panel isn't in the DOM.

Size: S–M. Research below done 2026-07-23 against
`libs/cdk/src/lib/components/accordion/`. Net-new in `libs/components` -
nothing accordion/disclosure-shaped exists there.

## What cdk ships today

`et-accordion` (signal inputs already: `label`, `isOpen` model,
`isOpenByDefault`, `disabled`; template label/hint via CdkPortal wrapper
directives) + `et-accordion-group` (`autoCloseOthers` enforcing single-open by
watching children's `isOpen` via RxJS `combineLatest`/`pairwise`). Solid a11y
base: heading + native `<button>` disclosure pattern (`aria-expanded`,
`aria-controls`, `role="region"`, **`inert` on the collapsed body** - keep
that). Animation is the CSS `grid-template-rows: 0fr → 1fr` trick with a
delayed `visibility` transition; no reduced-motion handling. Content is always
in the DOM (no lazy instantiation).

## Rewrite decisions

- **Animation: use `injectAnimatedBlockSize`** from `@ethlete/core`
  (`libs/core/src/lib/signals/animated-block-size.ts`) instead of the CSS grid
  trick - it's the established modern pattern (already used by `menu`,
  `date-time-input-panes`, form-field overlay surface, RTE token popup) and
  brings `prefers-reduced-motion` + interrupt-safe restarts for free.
- **Three-tier split** per `component-architecture`: headless disclosure
  directives (trigger + panel: ARIA wiring, `inert`, open state) and a default
  styled `et-accordion`/`et-accordion-group`. The headless disclosure trigger/
  panel pair is independently useful (FAQ sections, collapsible sidebars) -
  design it to stand alone.
- **Group logic in signals**, not RxJS: single-open enforcement is a
  `contentChildren` + effect over the children's `isOpen` models - drop the
  `toObservable`/`combineLatest`/`pairwise` plumbing.
- **Replace the CdkPortal label/hint wrappers** with the components lib's usual
  content-projection/template patterns (no `@angular/cdk/portal` dependency).
- **Add lazy content as an option** (`ng-template`-based deferred
  instantiation) - cdk always renders; heavy panel content (tables, images)
  wants lazy. Default stays eager for simplicity.
- **Icons**: chevron from the components icon system
  (`libs/components/src/lib/icon/headless/chevron-icon.ts`), not cdk's.
- **Styling**: `@layer components` CSS, `:where()` modifiers. cdk ships no
  colors (inherits ambient) - keep the default minimal, but any decorative
  color added must use surface/color tokens (`theming` skill).
- **Keep**: heading-level flexibility (cdk hardcodes `<h3>` - make the heading
  level configurable or headless), `disabled`, `isOpen` two-way model,
  hint/label slots.

## Deliverables

Headless directives + components, stories (basic, group single-open, custom
label/hint, lazy, reduced-motion), docs page
(`apps/docs/components/accordion.md`), changeset (`@ethlete/components`
minor). cdk accordion stays untouched.
