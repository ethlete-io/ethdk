---
name: component-architecture
description: The three-tier component design system (primitives / headless / default components) used across the @ethlete SDK. Read BEFORE creating or restructuring any component or directive in libs/components - new component, headless directive, sub-directive, design tokens, folder layout, error codes, or self-registration. Ensures new code matches the established architecture.
---

# Component architecture

The full spec lives in **`docs/COMPONENT-ARCHITECTURE.md`** - that file is the
source of truth. **Read it before non-trivial component work** (a new component,
splitting behavior from presentation, adding design tokens, or laying out a
domain folder). This skill is the index + the load-bearing rules; the doc has the
detail, examples, and rationale.

> Placement note: the doc names `libs/cdk` for Tier 2/3 because it predates the
> current split. `cdk` is now in maintenance mode - **new component work goes in
> `libs/components`** (`libs/components/src/lib/<domain>/`). The patterns below
> apply identically there. Tier 1 primitives still live in `libs/core`.

## Start with the generator

A new domain is scaffolded, not hand-assembled:

```bash
nx g @ethlete/components:component stat-tile --category="Data display"
# also: --tier=component|headless, --errors, --dry-run
```

It lays out the folder, the headless + default split, the `@layer components` stylesheet, the
imports barrel, a spec and a story, then wires the lib barrel, the docs page + sidebar entry and
(with `--errors`) the code range table in `docs/COMPONENT-ARCHITECTURE.md`. Everything it writes is
a placeholder you replace - it buys the wiring, not the design.

**`--category` is not cosmetic.** Every story lives under `Components/<Category>/<Name>`, and the
category is part of the story id the generated docs page embeds
(`components-data-display-stat-tile--default`). It prompts if you omit it and defaults to `Layout`;
the eleven categories are listed in `COMPONENT_CATEGORIES`
(`libs/components/generators/component/component-names.ts`), which is the single source of truth -
adding a twelfth means updating that array and `schema.json`'s enum together.

## The three-tier model

1. **Tier 1 - Primitives (`libs/core`).** Pure behavior, zero domain awareness
   (e.g. `ListKeyManagerDirective`, `OverlayDirective`). No public `--et-` design
   tokens; may own private `--_` tokens it sets itself.
2. **Tier 2 - Headless (`libs/components/.../headless/`).** All behavior + state
   for a domain, no visual opinion. Holds inputs/host-bindings/state. Sub-pieces
   self-register via DI. No template structure imposed. No public design tokens.
3. **Tier 3 - Default component (domain root).** Opinionated template + design
   tokens; applies the Tier 2 directive via `hostDirectives` and forwards inputs.
   Owns all `@property` token declarations. Covers ~90% of use cases zero-config.

## Rules that bite if you skip the doc

- **Self-registration**: sub-directives `inject(ParentDirective, { optional: true })`
  and call `parent.registerX(this)` in their constructor - the parent never uses
  `viewChild` to find them. Required pieces are enforced in dev only, via
  `if (ngDevMode) { afterNextRender(() => { if (!x()) throw new RuntimeError(...) }) }`.
- **Errors**: use `RuntimeError` from `@ethlete/core` (not native `Error`), with a
  numeric code from the domain's allocated range in a co-located `*-errors.ts`.
- **Design tokens**: public = `--et-{component}-{state}-{property}` (declared via
  `@property` in the Tier 3 `styles`); internal/JS-set = `--_et-…`. Pick
  `inherits` deliberately. Use native CSS nesting mirroring the DOM.
- **Styling**: plain CSS, `ViewEncapsulation.None`, global `et-`-prefixed classes.
  No Tailwind in component source (stories only). See root `CLAUDE.md`.
- **Component-directives**: a `@Component` with an attribute selector + `<ng-content>`
  when a Tier 2 piece needs `styles`/`@property` or internal queries. Behavioral
  component-directives (slot orchestration) use a **dash-case** selector
  (`et-foo-conditional, [et-foo-conditional]`).
- **Folder layout**: `headless/` only exists when a headless directive AND a
  presentational component sit at the same level. `headless/internals/` is not
  re-exported. Domain-wide infrastructure (managers, tokens, `*.imports.ts`) stays
  at the domain root. Barrels: `headless/index.ts`, then domain-root `index.ts`
  re-exports `./headless` + each component file.

## Conventions confirmed in the codebase

- Public API per domain is a barrel `index.ts`; the root `libs/components/src/index.ts`
  re-exports each domain.
- Each domain ships a `*.imports.ts` exporting a `const XXX_IMPORTS = [...] as const`
  aggregation array (e.g. `BUTTON_IMPORTS`) for consumers to spread into `imports`.
- Signals throughout: `input()` / `model()` / `output()`, `computed()`, `inject()`.
  DI tokens are `InjectionToken`s provided `useExisting` on the directive/component,
  with an `injectX()` helper where a provider factory exists.

When a change is non-trivial or you're unsure how a piece should be tiered, open
`docs/COMPONENT-ARCHITECTURE.md` and follow it - don't infer the architecture from
a single nearby file.

A new component domain also needs a guide page on the VitePress docs site
(`apps/docs/components/<domain>.md` + sidebar entry) - see the **`docs`** skill.
