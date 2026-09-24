---
name: app-styling
description: App components are styled with Tailwind utilities in their templates; app CSS stays out of @layer components; the SDK needs a 10px rem root; hardcoded colours are never primary values.
kind: rule
scope: consumer
requires: ['@ethlete/core']
---

## Styling

Every component in this workspace (views, pages, shells, shared UI in `libs/`) is laid out
and styled with **Tailwind utility classes in its template**, including the generated
theme utilities (`bg-et-surface-bg`, `border-et-surface-border`, `text-et-<theme>`). Do not
invent a BEM class system, and do not write a `.css` file for layout, spacing or
typography a utility expresses. Keep Angular's default view encapsulation.

Write CSS only for what utilities cannot express. Keep that CSS **unlayered** or in
`@layer utilities` — never in `@layer components`. SDK component styles are injected into
`@layer components` at runtime, after your stylesheet, so an app rule in the same layer
ties on layer and loses on source order.

To change an SDK component's look, set its `--et-*` tokens first (documented per
component), then use a utility class or unlayered CSS on the element — see "Overriding
component styles" in the docs site's components overview.

The SDK sizes everything in `rem` on a **10px root**: the app's global stylesheet must set
`html { font-size: 62.5%; }`. Without it every SDK control renders 1.6× too large. With it,
`1rem` is `10px`, so the app's own `rem` values stay easy to read.

**Never use a hardcoded colour as the primary value.** Backgrounds, text, borders and
interaction states resolve from the surface and colour theming tokens
(`--et-surface-*-solid`, `--et-theme-color-*`) or their generated utilities. A static
fallback inside `var(--token, <fallback>)` is permitted, but not required.

Theme **names** (`brand`, `danger`, `dark-elevated`, …) are registered by this app; the SDK
ships none. Semantic colours resolve by theme `type` (e.g. `injectErrorTheme()`).
