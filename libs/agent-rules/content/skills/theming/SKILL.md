---
name: theming
description: The two runtime theming systems in @ethlete/core - surface theming (elevation-aware neutrals) and color theming (semantic accent palettes) - how to register them in an app and how components must consume them. Read BEFORE writing or reviewing CSS that involves any color, background, border, or interaction state, and when wiring theme context across overlay/portal boundaries.
kind: skill
scope: consumer
requires: ['@ethlete/core']
paths: ['**/*.css']
vars: [docsBaseUrl]
---

# Surface & color theming

Two **independent** systems in `@ethlete/core`; most components consume both:

- **Surface theming** - the neutral, elevation-aware colors of the box a component
  sits on: background, text, muted/subtle text, borders, and a neutral
  "interaction" color for hover/active tints. Set via `[etProvideSurface]`.
- **Color theming** - semantic accent palettes (brand/primary, success, warning,
  error): a primary color, an on-primary contrast color, and an "ink" color for
  text/borders on transparent fills. Set via `[etProvideColor]`.

Full reference: {%docsBaseUrl%}/core/theming.

## Registering themes (once, in the app)

Your app owns the themes; the SDK ships none. Register them at bootstrap with
`provideSurfaceThemesWithTailwind4(SURFACE_THEMES)` and
`provideColorThemesWithTailwind4(THEMES)`, and generate the raw CSS variables with
the Nx generators shipped in `@ethlete/core`:

```bash
npx nx g @ethlete/core:tailwind-4-surface-theme
npx nx g @ethlete/core:tailwind-4-color-theme
```

The generated CSS defines the raw vars on `.et-surface--<name>` / `.et-color--<name>`
classes (plus `:root` defaults) and derives the public tokens below on `:root` **and**
every scope class - so the tokens are always resolvable and components just read them.

**Theme names are yours.** `brand`, `danger`, `neutral`, `dark-elevated` are only
examples. Never hardcode a theme-name union in a component type, a doc or an example.
The portable handle is the theme **`type`**: `injectErrorTheme()` finds whichever theme
the app registered with `type: 'error'`.

## Tokens components may consume

Use these **derived** tokens - never the raw `--et-surface-background` /
`--et-color-primary` channel triplets, and never a hardcoded color (a static fallback
_after_ the token is fine).

Surface (each exists as `-solid` = usable color, `-rgb` = `R G B` channels):

| Token                             | Use for                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--et-surface-background-solid`   | component/panel background                                                                                                                                                      |
| `--et-surface-color-solid`        | text                                                                                                                                                                            |
| `--et-surface-color-muted-solid`  | secondary text, placeholders, group labels                                                                                                                                      |
| `--et-surface-color-subtle-solid` | tertiary text                                                                                                                                                                   |
| `--et-surface-border-solid`       | borders, separators                                                                                                                                                             |
| `--et-surface-interaction-solid`  | neutral hover/active tint source - mix it: `color-mix(in srgb, var(--et-surface-interaction-solid) 12%, transparent)` (12/16/20% for hover/focus/active, 6–8% for subtle fills) |

Color (from the nearest `[etProvideColor]` scope):

| Token                            | Use for                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `--et-theme-color-primary`       | filled backgrounds; **opacity-aware** - set `--et-theme-color-primary-opacity: 0.16` etc. per state to tint without changing the color |
| `--et-theme-color-primary-solid` | accents at full strength: focus borders, selected marks, spinners                                                                      |
| `--et-theme-color-on-primary`    | text/icons on a primary-filled background                                                                                              |
| `--et-theme-color-ink-solid`     | primary-tinted text/border on transparent/tonal fills                                                                                  |

Interaction-state variants (`--et-surface-interaction-{hover,focus,active,disabled}-solid`)
resolve automatically per CSS state when the element has `[etSurfaceInteractive]`;
similarly `[etColorInteractive]` re-resolves the color tokens per state. Put either on
the interactive element itself, never on a wrapper.

## Providing context

- `[etProvideSurface]="'dark-elevated'"` / `[etAutoSurface]` (auto-picks the next
  elevation) set the surface scope; `[etProvideColor]="'brand'"` sets the color scope.
  A component that owns a themed region usually adds `ProvideColorDirective` /
  `ProvideSurfaceDirective` as `hostDirectives`.
- **Detached overlay panes (menu, dialog, tooltip…) do not inherit DOM context.**
  Re-apply it: inject `COLOR_PROVIDER` / `SURFACE_PROVIDER` with
  `{ optional: true, skipSelf: true }`, then `ownProvider.syncWithProvider(ctx)` for
  color and `resolveSurfaceByElevation(themes, type, elevation + 1)` for the surface.
- **Semantic colors come through DI, not CSS.** There is no global "error color"
  variable - error/warning/success are just color themes. To render something in the
  error color, `injectErrorTheme()` (it throws if the app registered no `type: 'error'`
  theme) and either bind it (`[etProvideColor]="errorColorTheme"`) or force it
  programmatically (`provideColor.forceColor(theme)` / `clearForcedColor()`). Inside
  that scope, `--et-theme-color-primary-*` _is_ the error color.

## Pitfalls

- `@property` `initial-value` cannot contain `var()`, so a public `--et-*` token
  declared via `@property` can never default to a theme token. If the default should
  come from the theme, don't declare an `@property` - consume the theme token directly
  (optionally behind a `--_et-*` indirection var).
- `--et-theme-color-primary-*` always resolves to the **nearest color scope**. A
  hardcoded semantic color in CSS can't be replaced by it unless the right theme is
  provided on that element.
- Keep a static fallback (`var(--et-surface-border-solid, rgb(255 255 255 / 0.1))`) so
  components degrade in theme-less setups. `injectErrorTheme()` is the exception: it is
  a hard requirement wherever it is used.
- **Cascade layers, not `:where()`, are what let a Tailwind utility override component
  CSS.** Wrap every component CSS file in `@layer components { … }`; `:where()` only
  flattens a component's own modifiers to single-class weight. See the `styling` rule.

Styling a **story** file rather than a component? The colour rule is the same, but the
Tailwind side has its own traps - {%skill:story-styling%}.
