# 05 — Breadcrumb

**Status: shipped 2026-07-28.** `libs/components/src/lib/breadcrumb/` — headless `etBreadcrumb` +
`etBreadcrumbItemTemplate` / `etBreadcrumbItem` / `etBreadcrumbSeparator` / `etBreadcrumbTemplate`,
default `et-breadcrumb` + `et-breadcrumb-outlet`, `provideBreadcrumbManager`,
`provideBreadcrumbLabels`, `BREADCRUMB_IMPORTS`, error codes ET37xx, stories, spec, docs page,
changeset.

Deviations from the plan below, all deliberate:

- **Overflow is a toggletip, not a menu.** The hidden crumbs are the consumer's links, and a
  `role="menu"` may only contain menu items — wrapping arbitrary anchors in `et-menu-item` would nest
  interactive elements. The toggletip keeps them a plain list of links, moves focus in, and restores it
  on Escape.
- **Measure-once collapsing instead of cdk's shrink loop.** cdk decremented a visible-item count per
  effect run, which only ever produced the binary all-or-first+menu+last shape anyway. This measures
  the full trail's `scroll.width` the moment it stops fitting, then collapses whenever the available
  width is below it — hysteresis, so a resize can't oscillate. Verified collapse at 500px → stays
  collapsed while growing → expands at 700px (full trail needs 606px) → re-collapses.
- **Crumb order comes from `contentChildren`, not self-registration.** Order _is_ the meaning of a
  breadcrumb, and registration order goes stale when a `@for` moves a view. Sorting the templates'
  anchor comment nodes by `compareDocumentPosition` was tried first and rejected: it disagrees between
  jsdom and the browser (detached comment nodes compare arbitrarily).
- **Added**: `aria-current="page"` on the last crumb (via `etBreadcrumbItem`), `<nav>`/`<ol>`/`<li>`
  semantics, localizable labels (`provideBreadcrumbLabels`), and truncation of the current page once
  even the collapsed trail doesn't fit.
- **Dropped** the `offset` input: the toggletip positions itself, so there is no floating-ui type to
  leak.
- **The outlet composes _all_ active segments, not the last registered template.** cdk's manager held a
  single `TemplateRef` (last write wins), so every page had to restate its ancestors' crumbs. Each view
  now registers an `etBreadcrumbSegment` with only the crumbs it owns, and the outlet renders every
  registered segment in view-creation order. Consequences, all documented in the guide: the routes must
  nest per crumb level (a `*ViewComponent` per level holding its segment + `<router-outlet>` — the shape
  the styleguide's routing rules already enforce), segments must be declared unconditionally (use a
  `loading` crumb for a pending label), and `order` is the escape hatch. Crumbs inside a segment register
  with it rather than being content-queried, because a content query cannot reach into a template another
  view renders; the breadcrumb pushes `isLast` onto the crumbs since only it knows the composed trail.

Size: S–M. Research below done 2026-07-23 against
`libs/cdk/src/lib/components/breadcrumb/`. Net-new in `libs/components`.

## What cdk ships today

A **template-registration** system, not route-config-driven: each routed
component declares `<ng-template etBreadcrumbTemplate>` containing an
`<et-breadcrumb>` with `etBreadcrumbItemTemplate` items; a `createProvider`
based manager holds the currently registered template and a single
`<et-breadcrumb-outlet>` (app shell) renders it. Overflow handling is JS
measurement (`signalHostElementScrollState`/`signalHostElementDimensions` from
core): shrink visible count until it fits (min 3), collapse middle items into a
menu keeping first + last visible. Items support a `loading` input rendering a
skeleton. All signal-based already.

## Rewrite decisions

- **Keep the template-registration architecture** — it's flexible (pages fully
  author their crumbs, incl. async/loading ones) and router-agnostic. The
  manager/outlet/template-directive trio splits naturally into the headless
  tier per `component-architecture`. Deliberately do **not** add
  route-config-derived crumbs in v1 (could be a later opt-in helper).
- **Keep the measure-and-collapse overflow algorithm** (first + last always
  visible, middle into a menu) — reuse the same core signals; the overflow menu
  uses the components lib `menu` (cdk used its own).
- **Fix a11y (real gap)**: cdk renders a bare flex container. The rewrite must
  use `<nav aria-label="breadcrumb">` + `<ol>/<li>` semantics and
  `aria-current="page"` on the last item.
- **Fix theming (broken today)**: cdk hardcodes hex colors inside
  `rgb(var(--_token))` indirections (hex in an rgb() slot — likely invalid in
  practice). Rebuild colors on surface/color tokens per the `theming` skill;
  `@layer components` CSS with `:where()`.
- **Loading state**: depends on `03-skeleton.md` — use the new skeleton once it
  exists; if breadcrumb lands first, ship without the loading feature rather
  than porting cdk's skeleton.
- **Separator**: chevron from the components icon system; make the separator a
  replaceable slot (template) while defaulting to the chevron.
- `offset` input (`@floating-ui/dom` `OffsetOptions`) — re-express in terms of
  the components lib's own menu/overlay positioning options; don't leak
  floating-ui types if the menu doesn't.

## Deliverables

Headless (manager provider, outlet, template directives) + styled
`et-breadcrumb`, stories (basic trail, overflow collapse with many items,
loading, custom separator), docs page (`apps/docs/components/breadcrumb.md`),
changeset. cdk breadcrumb stays untouched.
