---
name: styling
description: Component CSS is plain CSS in @layer components, and hardcoded colours are never primary values.
kind: rule
scope: both
requires: ['@ethlete/core']
---

## Component styling

Component styles are **plain CSS** — global `et-`-prefixed classes with
`ViewEncapsulation.None`, in a `.css` file next to the component. **Do not use Tailwind
in component source.** Utilities belong in application templates and story files, not in
the stylesheet a component ships.

**Wrap every component CSS file in `@layer components { … }`** — the whole file inside one
block. Component CSS is injected as a global `<style>` tag; unlayered, it beats Tailwind v4
utilities (which live in `@layer utilities`) regardless of specificity, because layer
precedence is resolved before specificity — so overriding `.et-button` would need
`flex!` instead of `flex`. `:where()` does not help across layers. Tailwind v4 pre-declares
`@layer theme, base, components, utilities`, so the wrap puts component styles where a
utility can win.

`:where()` has a separate job: keeping a component's own config modifiers
(`[data-size]`, `[data-variant]`, `[disabled]`) at the same single-class weight as its base
rule, so source order decides. Leave interaction states (`:hover`, `:focus-visible`,
`:active`) bare so they escalate and win.

**Never use a hardcoded colour as the primary value.** Backgrounds, text, borders and
interaction states resolve from the surface and colour theming tokens
(`--et-surface-*-solid`, `--et-theme-color-*`). A static fallback inside
`var(--token, <fallback>)` is permitted, but not required.

Theme **names** (`brand`, `danger`, `dark-elevated`, …) are registered by the application;
the SDK ships none. Never hardcode them as an SDK-defined union or reusable API contract.
If an app-specific example names one, label it as belonging to that app. Semantic colours
resolve by theme `type` (e.g. `injectErrorTheme()`).
