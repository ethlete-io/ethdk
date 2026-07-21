# Theming

`@ethlete/core` ships two independent runtime theming systems, and every Ethlete component consumes both:

- **Surface theming** — the elevation-aware neutral "box" a component sits on: background, text, muted/subtle text, border, and a neutral interaction tint. A surface has a `type` (`light` | `dark`) and an integer `elevation`, which powers auto-elevation (a nested panel picks the next elevation up in the same family).
- **Color theming** — semantic accent palettes (brand, success, warning, error). Each theme carries swatches of `color` (the fill), `onColor` (contrast content on that fill), and optionally `inkColor` (tinted text/border on transparent fills).

::: warning Theme names are yours, not the SDK's
The SDK defines **no** themes. Names like `brand`, `danger` or `dark-elevated` used below are just what this repo's Storybook registers — your app picks its own. Semantic behavior is addressed via the theme `type` (e.g. `type: 'error'`), never by name.
:::

## Registering themes

Define your themes in plain TypeScript files, register them at bootstrap, and generate the CSS from the same files:

```ts
// app.config.ts
import { provideColorThemesWithTailwind4, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import { SURFACE_THEMES } from '../surface-themes';
import { THEMES } from '../themes';

export const appConfig: ApplicationConfig = {
  providers: [...provideColorThemesWithTailwind4(THEMES), ...provideSurfaceThemesWithTailwind4(SURFACE_THEMES)],
};
```

The providers only make the themes known to Angular (for the directives and inject helpers below). The actual CSS variables are produced **at build time** by two Nx generators that read the same theme files:

```bash
yarn nx g @ethlete/core:tailwind-4-color-theme --themesPath=src/themes.ts
yarn nx g @ethlete/core:tailwind-4-surface-theme --themesPath=src/surface-themes.ts
```

Each generator emits a `.css` file (import it in your global styles; default `generated-tailwind-themes.css` / `generated-tailwind-surface-themes.css` under `src/styles/`) and a `.d.ts` next to it that registers your theme names with TypeScript — so `etProvideColor` / `etProvideSurface` autocomplete them. Re-run the generator whenever the theme files change — no need to remember the options you used: the header comment of each generated file contains the exact command to regenerate it. The generators validate the definitions: exactly one `isDefault` color theme, one default surface per `type`, and no duplicate semantic `type`s.

When several apps share one theme definition set (a monorepo) but need different defaults, pick the default at the generation invocation instead of in the definitions: `--defaultTheme=<name>` (color generator) and `--defaultLightTheme=<name>` / `--defaultDarkTheme=<name>` (surface generator, per surface `type`) make the named theme the default, overriding any `isDefault` flags — the definitions then don't need `isDefault` at all.

Both provider factories and generators accept a custom prefix (default `'et'`); the provider `prefix` argument must match the generator's `runtimePrefix`.

For code that needs to know the currently active surface (e.g. pickers rendering into overlays), `provideSurfaceContextTracker()` / `injectSurfaceContextTracker()` maintain a registration stack of surface `type` + `elevation` and expose the top entry as signals. Each open overlay registers its own surface, so the top entry is the innermost overlay's surface. `AutoSurfaceDirective` consults it too — see below.

## Surface themes

A `SurfaceTheme` — all colors are `"R G B"` channel strings:

| Field              | Type                | Required | Description                                                 |
| ------------------ | ------------------- | -------- | ----------------------------------------------------------- |
| `name`             | `string`            | yes      | Becomes the scope class `et-surface--<name>`.               |
| `type`             | `'light' \| 'dark'` | yes      | The elevation family.                                       |
| `elevation`        | `number`            | yes      | Integer; auto-surface resolves `elevation + 1`.             |
| `isDefault`        | `boolean`           | no       | Exactly one default per `type`.                             |
| `background`       | `"R G B"`           | yes      | Surface background.                                         |
| `color`            | `"R G B"`           | yes      | Primary text.                                               |
| `colorMuted`       | `"R G B"`           | yes      | Secondary text.                                             |
| `colorSubtle`      | `"R G B"`           | yes      | Tertiary text.                                              |
| `border`           | `"R G B"`           | yes      | Border color.                                               |
| `interactionColor` | interaction map     | no       | `{ default, hover, focus, active, disabled }` neutral tint. |

As an example, this repo's Storybook registers `light` (elevation 0), `light-elevated` (1), `dark` (0), `dark-elevated` (1) and `dark-elevated-2` (2).

Inside any surface scope (and on `:root`, resolved from the default surfaces per `prefers-color-scheme`), these tokens are available — each as `-rgb` (raw channels) and `-solid` (ready-to-use color):

- `--et-surface-background-{rgb,solid}`
- `--et-surface-color-{rgb,solid}`, `--et-surface-color-muted-{rgb,solid}`, `--et-surface-color-subtle-{rgb,solid}`
- `--et-surface-border-{rgb,solid}`
- `--et-surface-interaction-{,hover-,focus-,active-,disabled-}{rgb,solid}`

### Surface directives

| Directive                     | Selector                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProvideSurfaceDirective`     | `[etProvideSurface]`     | Sets the surface for the subtree: `<div etProvideSurface="dark">`. Without a value, inherits the parent surface.                                                                                                                                                                                                                                                                                                                                   |
| `AutoSurfaceDirective`        | `[etAutoSurface]`        | Picks the registered surface with the parent's `elevation + 1` in the same `type` — nested panels elevate themselves. Inside an overlay it also consults the surface-context tracker, so content elevates above the overlay's surface even though its injector points back at the trigger location. Overlay panels that _are_ the overlay's own surface call `ignoreOverlaySurfaceContext()` to adopt that elevation instead of stacking above it. |
| `SurfaceInteractiveDirective` | `[etSurfaceInteractive]` | Makes the surface tokens react to the host's `:hover` / `:focus-visible` / `:active` / `[disabled]` state using the neutral interaction tint.                                                                                                                                                                                                                                                                                                      |

## Color themes

A `ColorTheme` — colors accept `"R G B"` or `"H S% L%"` strings:

| Field       | Type                                | Required | Description                                                |
| ----------- | ----------------------------------- | -------- | ---------------------------------------------------------- |
| `name`      | `string`                            | yes      | Becomes the scope class `et-color--<name>`.                |
| `type`      | `'success' \| 'warning' \| 'error'` | no       | Semantic handle — see [semantic themes](#semantic-themes). |
| `isDefault` | `boolean`                           | no       | Exactly one theme should be default.                       |
| `primary`   | `ThemeSwatch`                       | yes      | The main swatch.                                           |
| `secondary` | `ThemeSwatch`                       | no       | Optional additional swatch.                                |
| `tertiary`  | `ThemeSwatch`                       | no       | Optional additional swatch.                                |

A `ThemeSwatch` is `{ color, onColor, inkColor? }`:

- `color` — the fill: `default`, `hover`, `active`, `disabled` required, `focus` optional.
- `onColor` — content rendered on the fill: only `default` required; missing states fall back (`focus` → `hover` → `default`).
- `inkColor` — optional tinted text/border for transparent or tonal fills; same fallbacks as `onColor`.

Inside a color scope these tokens resolve (the un-suffixed variant is opacity-aware):

- `--et-theme-color-primary`, `--et-theme-color-primary-{rgb,solid,opacity}`
- `--et-theme-color-on-primary`, `--et-theme-color-on-primary-{rgb,solid,opacity}`
- `--et-theme-color-ink`, `--et-theme-color-ink-{rgb,solid,opacity}`

### Color directives

| Directive                            | Selector                        | What it does                                                                                                                  |
| ------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ProvideColorDirective`              | `[etProvideColor]`              | Sets the color theme for the subtree. Accepts a registered name **or** a full `ColorTheme` object.                            |
| `ColorInteractiveDirective`          | `[etColorInteractive]`          | Re-resolves the color tokens per the host's own interaction state. Put it on the interactive element itself, never a wrapper. |
| `ColorInteractiveContainerDirective` | `[etColorInteractiveContainer]` | Cascades hover/active state down to descendant `etColorInteractive` elements.                                                 |
| `ColorInteractiveExcludeDirective`   | `[etColorInteractiveExclude]`   | Marks a descendant as not triggering an ancestor's interactive reaction.                                                      |
| `ColorInteractiveHasFocusDirective`  | `[etColorInteractiveHasFocus]`  | Tints tokens only while the host contains a `:focus-visible` element — never on hover/active.                                 |

## Semantic themes

Because names are app-defined, code that needs "the error color" resolves it by `type`:

```ts
import { injectErrorTheme } from '@ethlete/core';

@Component({
  template: `<span [etProvideColor]="errorTheme">…</span>`,
})
export class ViolationHintComponent {
  errorTheme = injectErrorTheme();
}
```

`injectErrorTheme()`, `injectWarningTheme()` and `injectSuccessTheme()` return the registered `ColorTheme` with the matching `type` — and throw if the app hasn't registered one, so components can rely on them.

## Legacy runtime theming

`provideColorThemes(themes)` (without the `WithTailwind4` suffix) is the previous, Tailwind-v3-era system: it injects `<style>` tags at runtime instead of generating CSS at build time. It — along with its helpers (`createThemeStyle`, `createTailwindColorThemes`, …) — is **deprecated** with intent to remove in v6. New apps should use the generator-based setup above.
