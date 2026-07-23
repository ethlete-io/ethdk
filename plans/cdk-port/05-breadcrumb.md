# 05 — Breadcrumb

**Status: planned, not started.** Size: S–M. Research done 2026-07-23 against
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
