---
applyTo: 'libs/**'
---

# SDK Component Architecture Rules

Full reference: `docs/COMPONENT-ARCHITECTURE.md`

## Three-Tier Model

- **Tier 1** (`libs/core`): pure behavior primitives — no `libs/cdk` deps, no public `--et-` design tokens, no `hostDirectives` pointing to Tier 2/3
- **Tier 2** (`libs/cdk`): headless directive — holds all inputs / state / host bindings, sub-components self-register via DI, no public design tokens, no template opinions
- **Tier 3** (`libs/cdk`): default component — `hostDirectives: [Tier2Directive]` with forwarded inputs, owns all `@property` declarations, includes required sub-directives in its template, consumes theme vars but does **not** include `ProvideThemeDirective`

## Self-Registration Pattern

Sub-directives `inject(ParentDirective, { optional: true })` in their constructor and call `parent?.registerX(this)`. Parent stores the child in a `signal<Child | null>(null)`. Parent never uses `viewChild` to find sub-directives.

## Required vs Optional Sub-Components

**Required** sub-components: wrap the entire `afterNextRender` in `if (ngDevMode)` (tree-shakes the closure and scheduler registration in production). Throw `RuntimeError` with a domain error code and `devOnly: true`.

**Optional** sub-components: absence disables a feature gracefully — no error thrown.

```ts
if (ngDevMode) {
  afterNextRender(() => {
    if (!this._trigger())
      throw new RuntimeError(DomainErrorCode.MISSING_X, '[MyDirective] X not found. Add [etX] to the template.', true);
  });
}
```

## Error System

- Use `RuntimeError` from `@ethlete/core`, never the native `Error` — produces `ET{code}: [DEV ONLY] message`
- Error codes live in a co-located `*-errors.ts` as a `const` object (not a TypeScript `enum` — enums are not fully tree-shakeable)
- Message format: `[DirectiveName] <what is wrong>. <how to fix it>.`
- Code ranges: Select 1000–1099 | Combobox 1100–1199 | Overlay 1200–1299 | Menu 1300–1399 | Tooltip 1400–1499 | Toggletip 1500–1599

## Inputs / Outputs

All configurable values use `input()` / `model()` / `output()` with sensible defaults — never `readonly` class constants.

## Design Tokens

- **Public** `--et-{component}-{property}`: declared with `@property` in Tier 3 `styles`, stable API surface
- **Private** `--_et-{component}-{property}`: declared at whichever tier sets them, not part of the public API
- `inherits: true` for layout/spacing values that must cascade; `inherits: false` for component-local values

## Component-Directives

Use `@Component` with an attribute selector and `<ng-content />` (instead of `@Directive`) when the piece needs `styles` / `@property` declarations, `viewChild` / `contentChild`, or a content slot. Limit: one component-directive per native host element.

A **behavioral component-directive** is a special variant that contains behavioral template logic (conditional content projection, slot orchestration) instead of a plain `<ng-content />`. It:

- Uses a combined element + attribute selector in **dash-case**: `et-foo-conditional, [et-foo-conditional]` (dash-case distinguishes it from regular camelCase attribute directives)
- Sits alongside the Tier 2 directive — it is not Tier 3
- Injects the parent Tier 2 token to read state and render accordingly; has no `hostDirectives` of its own
- The Tier 3 component places it in its template, provides the `ng-template` slots internally (with `<ng-content />` inside the content slot), and owns the `@property` design tokens — making it fully batteries-included for consumers

## Theming

Tier 3 components consume theme CSS custom properties passively. Consumers apply `[etProvideTheme]="name"` on the component's host element from the outside. Portal / overlay containers that are detached from the DOM tree inject `THEME_PROVIDER` from their trigger context and call `syncWithProvider()` to mirror the theme.

## Library Placement

| Tier                   | Location                          |
| ---------------------- | --------------------------------- |
| 1 — Primitives         | `libs/core`                       |
| 2 — Headless           | `libs/cdk` (alongside its Tier 3) |
| 3 — Default components | `libs/cdk` (alongside its Tier 2) |
