---
name: theming
description: The surface and color theming systems in @ethlete/core. Read BEFORE writing or reviewing CSS involving color, background, border or interaction state, or wiring theme context across overlays/portals.
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

**Theme names are yours.** Never hardcode them as an SDK-defined union or reusable API
contract. App-specific docs may name their own themes when they label them as app values.
The portable handle is the theme **`type`**: `injectSemanticColorTheme('error')` finds
whichever theme the app registered with `type: 'error'`.

## Tokens components may consume

Use these tokens - each is a ready color, never a channel triplet. Never use a hardcoded color as the primary value.
A static fallback inside `var(--token, <fallback>)` is permitted, but not required.

Surface:

| Token                      | Use for                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--et-surface-background`  | component/panel background                                                                                                                                                |
| `--et-surface-text`        | text                                                                                                                                                                      |
| `--et-surface-text-muted`  | secondary text, placeholders, group labels                                                                                                                                |
| `--et-surface-text-subtle` | tertiary text                                                                                                                                                             |
| `--et-surface-border`      | borders, separators                                                                                                                                                       |
| `--et-surface-interaction` | neutral hover/active tint source - mix it: `color-mix(in srgb, var(--et-surface-interaction) 12%, transparent)` (12/16/20% for hover/focus/active, 6–8% for subtle fills) |

Color (from the nearest `[etProvideColor]` scope):

| Token               | Use for                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--et-tone-fill`    | filled backgrounds and accents at full strength: focus borders, selected marks, spinners. To tint per state, compose it yourself: `color-mix(in srgb, var(--et-tone-fill) calc(var(--_et-tone-fill-opacity, 1) * 100%), transparent)` |
| `--et-tone-on-fill` | text/icons on a primary-filled background                                                                                                                                                                                             |
| `--et-tone-text`    | primary-tinted text/border on transparent/tonal fills                                                                                                                                                                                 |

`[etColorInteractive]` re-resolves the color tokens per CSS state. Put it on the
interactive element itself, never on a wrapper. Neutral hover and pressed feedback mixes
`--et-surface-tint` per state at the consumer; `etSurfaceInteractive` is removed.

**Never use `hover:bg-et-surface-control-text-hover` for a hover row.** The token is a
full-strength text colour, so in dark mode it gives a light row with near-white text. Mix
the tint instead: `hover:bg-et-surface-tint/9 active:bg-et-surface-tint/15`.

## Providing context

- `[etProvideSurface]="surfaceThemeName"` / `[etAutoSurface]` (auto-picks the next
  elevation) set the surface scope; `[etProvideColor]="colorThemeName"` sets the color scope.
  A component that owns a themed region usually adds `ProvideColorDirective` /
  `ProvideSurfaceDirective` as `hostDirectives`.
- **Detached overlay panes (menu, dialog, tooltip…) do not inherit DOM context.**
  Re-apply it: inject `COLOR_PROVIDER` / `SURFACE_PROVIDER` with
  `{ optional: true, skipSelf: true }`, then `ownProvider.syncWithProvider(ctx)` for
  color and `resolveSurfaceByElevation(themes, type, elevation + 1)` for the surface.
- **Semantic colors come through DI, not CSS.** There is no global "error color"
  variable - error/warning/success are just color themes. To render something in the
  error color, `injectSemanticColorTheme('error')` (reading it throws if the app
  registered no `type: 'error'` theme) and either bind it
  (`[etProvideColor]="errorColorTheme()"`) or force it programmatically
  (`provideColor.forceColor(theme)` / `clearForcedColor()`). Inside that scope,
  `--et-tone-*` _is_ the error color.
- **A surface swaps a chosen accent; it never picks one.** The chosen accent is the
  nearest `[etProvideColor]`, else the `isDefault` theme, or for
  `injectSemanticColorTheme(type)` the theme of that `type`. The nearest surface's
  `SurfaceTheme.colorThemeVariants` (e.g. `{ brand: 'brand-on-light', success: 'success-on-light' }`,
  variants registered without a `type`) swaps it; an accent without an entry stays the
  same on every surface. With no surface above, the root surface swaps, and
  `provideColorScheme()` paints its swap of the default accent on `<html>`. A neutral that follows the surface is `color="surface"`
  (`interactionColor`), not a variant. `colorTheme` and `semanticColorThemes` are
  deprecated. Never add per-surface logic to a color theme or new CSS vars for it.
  `injectErrorTheme()`, `injectWarningTheme()` and `injectSuccessTheme()` are
  deprecated: they ignore the surface.

## Pitfalls

- A surface theme may have `elevation: -1` (a literal unary minus); the generator fails on a theme it cannot
  parse. Filled form fields, table card rows and grid items resolve `parent.elevation + 1`; toasts and
  `@ethlete/cdk` overlays with a backdrop always resolve elevation 1 (without a backdrop, `parent + 1`), and the
  overlay scope class goes from `et-surface--inherited` to `et-surface--<theme>`. `@ethlete/cdk` CSS reads no
  `--et-surface-*` token, so `etProvideSurface` on a cdk host does nothing.
- `@property` `initial-value` cannot contain `var()`, so a public `--et-*` token
  declared via `@property` can never default to a theme token. If the default should
  come from the theme, don't declare an `@property` - consume the theme token directly
  (optionally behind a `--_et-*` indirection var).
- `@property` `initial-value` also cannot use a **font-relative or container unit**
  (`em`, `rem`, `ex`, `ch`, `lh`, `cap`, `ic`, `cq*`). The value must be computationally
  independent, so the browser drops the whole rule and leaves the token unregistered -
  with no error. Percentages and viewport units (`vh`, `vw`, `dvh`) are fine. When the
  default has to be relative, use `syntax: '*'` with no `initial-value` and put the
  default in a fallback at each use site: `var(--et-skeleton-size, 1em)`.
- `--et-tone-*` always resolves to the **nearest color scope**. A
  hardcoded semantic color in CSS can't be replaced by it unless the right theme is
  provided on that element.
- A static fallback (`var(--et-surface-border, rgb(255 255 255 / 0.1))`) is
  permitted for theme-less setups, but themes make it unnecessary. `injectSemanticColorTheme()`
  is a hard requirement wherever it is read.
- **Cascade layers, not `:where()`, decide who wins against SDK component CSS.** SDK
  styles live in `@layer components.sdk`, nested in `components`, so an app rule in
  `@layer components`, a utility, or unlayered app CSS overrides them. See the
  `app-styling` rule.

Styling a **story** file rather than a component? The colour rule is the same. Check the
repository's Storybook guidance before assuming a Tailwind utility exists.
