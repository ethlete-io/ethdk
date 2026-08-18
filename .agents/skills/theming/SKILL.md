---
name: theming
description: The two runtime theming systems in this repo - surface theming (elevation-aware neutrals) and color theming (semantic accent palettes) - and how components in libs/components must consume them. Read BEFORE writing or reviewing component CSS that involves any color, background, border, or interaction state, and when wiring theme context across overlay/portal boundaries.
---

# Surface & color theming

Everything lives in `libs/core/src/lib/theming/`. There are **two independent
systems**; most components consume both:

- **Surface theming** - neutral, elevation-aware colors of the box a component
  sits on: background, text, muted/subtle text, borders, and a neutral
  "interaction" color for hover/active tints. Set via `[etProvideSurface]`.
- **Color theming** - semantic accent palettes (brand/primary, success,
  warning, error): a primary color, an on-primary contrast color, and an "ink"
  color for text/borders on transparent fills. Set via `[etProvideColor]`.

Apps register themes with `provideSurfaceThemesWithTailwind4(SURFACE_THEMES)` and
`provideColorThemesWithTailwind4(THEMES)`, and generate the raw CSS variables with
the Nx generators in `libs/core/generators/tailwind-4-{surface,color}-theme/`.
The generated CSS defines the raw vars on `.et-surface--<name>` / `.et-color--<name>`
classes (plus `:root` defaults) and derives the public tokens below on `:root`
and every scope class - so the tokens are **always resolvable**; components just
read them.

Storybook (`apps/storybook`) registers both systems globally
(`.storybook/preview.ts`, themes in `src/themes.ts` / `src/surface-themes.ts`),
including a `danger` theme with `type: 'error'`.

**Theme names are app-defined - the SDK ships none.** Names like `brand`,
`danger`, `neutral` or `dark-elevated` are just what this repo's Storybook
registers. Never hardcode a theme-name union in component types, docs, or
examples - present such names as app examples only. The portable handle is the
theme **`type`** (`injectErrorTheme()` finds the app's `type: 'error'` theme),
not the name.

## Tokens components may consume

Component CSS must use these **derived** tokens - never the raw
`--et-surface-background` / `--et-color-primary` channel triplets, and never
hardcoded colors (a static fallback after the token is fine).

Surface (each exists as `-solid` = usable color, `-rgb` = `R G B` channels):

| Token | Use for |
| --- | --- |
| `--et-surface-background-solid` | component/panel background |
| `--et-surface-color-solid` | text |
| `--et-surface-color-muted-solid` | secondary text, placeholders, group labels |
| `--et-surface-color-subtle-solid` | tertiary text |
| `--et-surface-border-solid` | borders, separators |
| `--et-surface-interaction-solid` | neutral hover/active tint source - mix it: `color-mix(in srgb, var(--et-surface-interaction-solid) 12%, transparent)` (button uses 12/16/20% for hover/focus/active, 6–8% for subtle fills) |

Color (from the nearest `[etProvideColor]` scope):

| Token | Use for |
| --- | --- |
| `--et-theme-color-primary` | filled backgrounds on an element you do **not** tint. To tint per state, set `--et-theme-color-primary-opacity: 0.16` and compose the color yourself: `rgb(var(--et-theme-color-primary-rgb) / var(--et-theme-color-primary-opacity))` (see button tonal/outline variants). The alias is substituted at the `et-color--*` scope, so an inherited value carries the scope's opacity, never the element's |
| `--et-theme-color-primary-solid` | accents at full strength: focus borders, selected marks, spinners |
| `--et-theme-color-on-primary` | text/icons on a primary-filled background |
| `--et-theme-color-ink-solid` | primary-tinted text/border on transparent/tonal fills |

Interaction-state variants (`--et-surface-interaction-{hover,focus,active,disabled}-solid`)
resolve automatically per CSS state when the element has `[etSurfaceInteractive]`;
similarly `[etColorInteractive]` re-resolves the color tokens per state (put it on
the interactive element itself, never a wrapper).

## Providing context

- `[etProvideSurface]="'dark-elevated'"` / `[etAutoSurface]` (auto-picks the next
  elevation) set the surface scope; `[etProvideColor]="'brand'"` sets the color
  scope. Tier-3 components usually add `ProvideColorDirective` /
  `ProvideSurfaceDirective` as `hostDirectives`.
- **Detached overlay panes (menu, dialog, tooltip…) do not inherit DOM context.**
  Re-apply it: inject `COLOR_PROVIDER` / `SURFACE_PROVIDER` with
  `{ optional: true, skipSelf: true }`, then `ownProvider.syncWithProvider(ctx)`
  for color and `resolveSurfaceByElevation(themes, type, elevation + 1)` for the
  surface. Reference: `libs/components/src/lib/menu/menu.component.ts`.
- **Semantic colors are provided via DI, not CSS.** There is no global "error
  color" variable - error/warning/success are just color themes. To render
  something in the error color, inject `injectErrorTheme()` (throws if the app
  registered no `type: 'error'` theme) and either bind it
  (`[etProvideColor]="errorColorTheme"`, see form-field's error text and the
  menu search error) or force it programmatically
  (`provideColor.forceColor(theme)` / `clearForcedColor()`, see form-field's
  error state and the menu item destructive variant). Inside that scope,
  `--et-theme-color-primary-*` *is* the error color.

## Pitfalls

- `@property` `initial-value` cannot contain `var()`, so a public `--et-*`
  token declared via `@property` can never default to a theme token. If the
  default should come from the theme, don't declare an `@property` - consume the
  theme token directly (optionally behind a `--_et-*` indirection var).
- `@property` `initial-value` also cannot use a **font-relative or container
  unit** (`em`, `rem`, `ex`, `ch`, `lh`, `cap`, `ic`, `cq*`). The value must be
  computationally independent, so the browser drops the whole rule and leaves the
  token unregistered - with no error. Percentages and viewport units (`vh`, `vw`,
  `dvh`) are fine. When the default has to be relative, use `syntax: '*'` with no
  `initial-value` and put the default in a fallback at each use site:
  `var(--et-skeleton-size, 1em)`. `yarn lint:css-properties` checks this, and
  pre-commit runs it on staged files.
- `--et-theme-color-primary-*` always resolves to the **nearest color scope** -
  a hardcoded semantic color in CSS can't be replaced by it unless the right
  theme is provided on that element (see DI point above).
- Fallbacks: tokens resolve wherever themes are registered, but keep a static
  fallback (`var(--et-surface-border-solid, rgb(255 255 255 / 0.1))`) so
  components degrade in theme-less setups. `injectErrorTheme()` however is a
  hard requirement - form-field and menu already assume it.
- **Cascade layers, not `:where()`, are what make Tailwind utilities override
  component CSS.** Every component CSS file is wrapped in `@layer components { … }`
  - keep doing so in new/edited files. Component styles are injected unlayered
  otherwise, which beats Tailwind's `@layer utilities` by layer precedence, so a
  consumer would need `!important`; specificity (and therefore `:where()`) never
  enters into it across layers. Use `:where()` only to keep a component's own
  config modifiers at single-class specificity. Full explanation in the "Cascade
  layers" note in `CLAUDE.md`.

## Reference implementations

- `libs/components/src/lib/button/button.component.css` - canonical color-system
  consumer (opacity mechanic per variant/state) + neutral `color-mix` tints over
  `--et-surface-interaction-solid` ("muted until pressed" block).
- `libs/components/src/lib/forms/form-field/form-field.component.css` +
  `.component.ts` - borders/hover from surface tokens, focus border
  `--et-theme-color-primary-solid`, error state via `forceColor(injectErrorTheme())`.
- `libs/components/src/lib/menu/` - full pattern in an overlay: context re-sync,
  surface tokens for chrome, error theme for destructive items/search error.

Full docs: `libs/core/src/lib/theming/surface-theming.docs.mdx` and
`color-theming.docs.mdx` (Storybook pages with the complete token tables and
theme structure).

Styling a **story** file rather than a component? The same colour rule applies (no
hardcoded colours, no `dark:` - a story sits inside a surface theme too), but the
Tailwind side has its own traps: Storybook's theme resets `--color-*` and
`--text-*`, so most utilities you'd reach for don't exist. See the
**`storybook-styling`** skill.
