# 04 — Accordion

**Status: planned, not started.** Size: S–M. Research done 2026-07-23 against
`libs/cdk/src/lib/components/accordion/`. Net-new in `libs/components` —
nothing accordion/disclosure-shaped exists there.

## What cdk ships today

`et-accordion` (signal inputs already: `label`, `isOpen` model,
`isOpenByDefault`, `disabled`; template label/hint via CdkPortal wrapper
directives) + `et-accordion-group` (`autoCloseOthers` enforcing single-open by
watching children's `isOpen` via RxJS `combineLatest`/`pairwise`). Solid a11y
base: heading + native `<button>` disclosure pattern (`aria-expanded`,
`aria-controls`, `role="region"`, **`inert` on the collapsed body** — keep
that). Animation is the CSS `grid-template-rows: 0fr → 1fr` trick with a
delayed `visibility` transition; no reduced-motion handling. Content is always
in the DOM (no lazy instantiation).

## Rewrite decisions

- **Animation: use `injectAnimatedBlockSize`** from `@ethlete/core`
  (`libs/core/src/lib/signals/animated-block-size.ts`) instead of the CSS grid
  trick — it's the established modern pattern (already used by `menu`,
  `date-time-input-panes`, form-field overlay surface, RTE token popup) and
  brings `prefers-reduced-motion` + interrupt-safe restarts for free.
- **Three-tier split** per `component-architecture`: headless disclosure
  directives (trigger + panel: ARIA wiring, `inert`, open state) and a default
  styled `et-accordion`/`et-accordion-group`. The headless disclosure trigger/
  panel pair is independently useful (FAQ sections, collapsible sidebars) —
  design it to stand alone.
- **Group logic in signals**, not RxJS: single-open enforcement is a
  `contentChildren` + effect over the children's `isOpen` models — drop the
  `toObservable`/`combineLatest`/`pairwise` plumbing.
- **Replace the CdkPortal label/hint wrappers** with the components lib's usual
  content-projection/template patterns (no `@angular/cdk/portal` dependency).
- **Add lazy content as an option** (`ng-template`-based deferred
  instantiation) — cdk always renders; heavy panel content (tables, images)
  wants lazy. Default stays eager for simplicity.
- **Icons**: chevron from the components icon system
  (`libs/components/src/lib/icon/headless/chevron-icon.ts`), not cdk's.
- **Styling**: `@layer components` CSS, `:where()` modifiers. cdk ships no
  colors (inherits ambient) — keep the default minimal, but any decorative
  color added must use surface/color tokens (`theming` skill).
- **Keep**: heading-level flexibility (cdk hardcodes `<h3>` — make the heading
  level configurable or headless), `disabled`, `isOpen` two-way model,
  hint/label slots.

## Deliverables

Headless directives + components, stories (basic, group single-open, custom
label/hint, lazy, reduced-motion), docs page
(`apps/docs/components/accordion.md`), changeset (`@ethlete/components`
minor). cdk accordion stays untouched.
