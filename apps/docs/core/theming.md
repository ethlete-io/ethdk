# Theming

`@ethlete/core` ships two independent runtime theming systems, and every Ethlete component consumes both:

- **Surface theming** - the elevation-aware neutral "box" a component sits on: background, text, muted/subtle text, border, and a neutral interaction tint. A surface has a `type` (`light` | `dark`) and an integer `elevation`, which powers auto-elevation (a nested panel picks the next elevation up in the same family).
- **Color theming** - semantic accent palettes (brand, success, warning, error). Each theme carries swatches of `color` (the fill), `onColor` (contrast content on that fill), and optionally `inkColor` (tinted text/border on transparent fills).

::: warning Theme names are yours, not the SDK's
The SDK defines **no** themes. Names like `brand`, `danger` or `dark-elevated` used below are just what this repo's Storybook registers - your app picks its own. Semantic behavior is addressed via the theme `type` (e.g. `type: 'error'`), never by name.
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

Each generator emits a `.css` file (import it in your global styles; default `generated-tailwind-themes.css` / `generated-tailwind-surface-themes.css` under `src/styles/`) and a `.d.ts` next to it that registers your theme names with TypeScript - so `etProvideColor` / `etProvideSurface` autocomplete them. Re-run the generator whenever the theme files change - no need to remember the options you used: the header comment of each generated file contains the exact command to regenerate it. The generators validate the definitions: exactly one `isDefault` color theme, one default surface per `type`, and no duplicate semantic `type`s.

When several apps share one theme definition set (a monorepo) but need different defaults, pick the default at the generation invocation instead of in the definitions: `--defaultTheme=<name>` (color generator) and `--defaultLightTheme=<name>` / `--defaultDarkTheme=<name>` (surface generator, per surface `type`) make the named theme the default, overriding any `isDefault` flags - the definitions then don't need `isDefault` at all.

Both provider factories and generators accept a custom prefix (default `'et'`); the provider `prefix` argument must match the generator's `runtimePrefix`.

For code that needs to know the currently active surface (e.g. pickers rendering into overlays), `provideSurfaceContextTracker()` / `injectSurfaceContextTracker()` maintain a registration stack of surface `type` + `elevation` - each open overlay registers its own surface together with its pane element. `surfaceForElement(host)` returns the surface of the innermost overlay whose pane actually **contains** `host` in the DOM, or `null` when `host` sits outside every open overlay. `AutoSurfaceDirective` uses it so opening an overlay only affects auto-surfaces rendered inside it - see below. A layer that renders outside every pane (the notification stack) resolves its own surface instead of following what is open, so it never re-shades while it is on screen.

## Surface themes

A `SurfaceTheme` - all colors are `"R G B"` channel strings:

| Field              | Type                | Required | Description                                     |
| ------------------ | ------------------- | -------- | ----------------------------------------------- |
| `name`             | `string`            | yes      | Becomes the scope class `et-surface--<name>`.   |
| `type`             | `'light' \| 'dark'` | yes      | The elevation family.                           |
| `elevation`        | `number`            | yes      | Integer; auto-surface resolves `elevation + 1`. |
| `isDefault`        | `boolean`           | no       | Exactly one per `type`; paints `:root`.         |
| `background`       | `"R G B"`           | yes      | Surface background.                             |
| `color`            | `"R G B"`           | yes      | Primary text.                                   |
| `colorMuted`       | `"R G B"`           | yes      | Secondary text.                                 |
| `colorSubtle`      | `"R G B"`           | yes      | Tertiary text.                                  |
| `border`           | `"R G B"`           | yes      | Border color.                                   |
| `interactionColor` | swatch              | no       | The surface's neutral swatch - see below.       |

As an example, this repo's Storybook registers `light` (elevation 0), `light-elevated` (1), `dark` (0), `dark-elevated` (1) and `dark-elevated-2` (2).

`interactionColor` is shaped like a color theme's swatch and does two jobs:

```ts
interactionColor: {
  color: { default: '115 115 115', hover: '64 64 64', focus: '64 64 64', active: '23 23 23', disabled: '180 180 180' },
  onColor: { default: '255 255 255' },   // optional, defaults to `background`
  inkColor: { default: '23 23 23' },     // optional, defaults to `color`
}
```

`color` is the neutral tint `[etSurfaceInteractive]` mixes for hover/active feedback, and the swatch as
a whole is the palette that [`etProvideColor="surface"`](#the-surface-color) resolves - so `onColor`
is the text on a filled neutral button and `inkColor` the text and borders on a tinted one. Its ladder
should escalate towards the surface's text color, the way the tint does.

::: tip Upgrading
`interactionColor` used to be the flat `{ default, hover, … }` map that is now nested under `color`.
Run `nx g @ethlete/core:migrate-surface-interaction-swatch` to convert your definitions, then
regenerate the CSS.
:::

Inside any surface scope (and on `:root` - see [The root surface](#the-root-surface)), these tokens are available - each as `-rgb` (raw channels) and `-solid` (ready-to-use color):

- `--et-surface-background-{rgb,solid}`
- `--et-surface-color-{rgb,solid}`, `--et-surface-color-muted-{rgb,solid}`, `--et-surface-color-subtle-{rgb,solid}`
- `--et-surface-border-{rgb,solid}`
- `--et-surface-interaction-{,hover-,focus-,active-,disabled-}{rgb,solid}`

The swatch's `onColor` and `inkColor` are not exposed as component tokens - they reach components
through the [`surface` color scope](#the-surface-color) - but they do generate the Tailwind utilities
`text-et-surface-on-interaction` and `text-et-surface-interaction-ink`.

### The root surface

The `isDefault` themes paint `:root`, so an app renders on its default surface without scoping one.
How that lands depends on what the app registers:

- **Both types** - the light default sits behind `@media (prefers-color-scheme: light)`, the dark one
  behind `dark`, and the root follows the user's OS preference.
- **One type** (a dark-only app) - the sole default lands on plain `:root`. There is no other scheme
  to switch to, and behind a media query the surface variables would be undefined for everyone whose
  OS asks for the scheme the app doesn't have.

Either way the block also sets `color-scheme`, so scrollbars and native controls match the surface.

The runtime knows the same default: `injectDefaultSurfaceTheme(type?)` returns the registered
`isDefault` theme - of the only type the app registers, or of the `type` you name (an app with both
has to say which, since `:root` picks between them by `prefers-color-scheme`). `injectSurfaceType()`
returns a signal with the `'light' | 'dark'` a subtree renders on: the surrounding provider's type,
or the default's where nothing provides one. A `ProvideSurfaceDirective` with nothing above it and
no surface set resolves that default too, so a single-scheme app's `elevation()` and `surfaceType()`
describe its real root surface.

A nested provider left unset still paints nothing - it keeps the inherited surface on screen - but it
reports what it inherits: `activeTheme()` walks up to the closest provider that resolves a surface,
and `elevation()` and `surfaceType()` read from it. Content below an unset provider therefore
elevates above the surface it really sits on.

`injectParentSurface()` returns a signal with the whole `SurfaceTheme` a subtree renders on - the
surrounding provider's `activeTheme()`, or the app default where nothing provides one. Use it to
derive an elevation relative to the surrounding surface:

```ts
private parentSurface = injectParentSurface();
private themes = injectSurfaceThemes({ optional: true });

private mySurface = computed(() => {
  const parent = this.parentSurface();

  if (!this.themes || !parent) return null;

  return resolveSurfaceByElevation(this.themes, parent.type, parent.elevation + 1);
});
```

It returns `null` for an app that registers a default per surface type. `prefers-color-scheme`
decides which of the two `:root` paints, so the root surface of such an app cannot be resolved at
runtime. Scope a surface explicitly with `etProvideSurface` where a subtree must elevate anyway.

### Surface directives

| Directive                     | Selector                 | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProvideSurfaceDirective`     | `[etProvideSurface]`     | Sets the surface for the subtree: `<div etProvideSurface="dark">`. Without a value, inherits the parent surface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `AutoSurfaceDirective`        | `[etAutoSurface]`        | Picks the registered surface with the parent's `elevation + 1` in the same `type` - nested panels elevate themselves. With no provider above it, the parent is the app's [root surface](#the-root-surface), so it elevates above that. Content rendered inside an overlay also consults the surface-context tracker (matched by DOM containment), so it elevates above the overlay's surface even though its injector points back at the trigger location - while auto-surfaces on the base page are unaffected when an overlay opens. Overlay panels that _are_ the overlay's own surface call `matchOverlaySurface()` to paint the overlay's registered elevation from the tracker exactly, instead of stacking above it. |
| `SurfaceInteractiveDirective` | `[etSurfaceInteractive]` | Makes the surface tokens react to the host's `:hover` / `:focus-visible` / `:active` / `[disabled]` state using the neutral interaction tint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Color themes

A `ColorTheme` - colors accept `"R G B"` or `"H S% L%"` strings:

| Field       | Type                                | Required | Description                                                |
| ----------- | ----------------------------------- | -------- | ---------------------------------------------------------- |
| `name`      | `string`                            | yes      | Becomes the scope class `et-color--<name>`.                |
| `type`      | `'success' \| 'warning' \| 'error'` | no       | Semantic handle - see [semantic themes](#semantic-themes). |
| `isDefault` | `boolean`                           | no       | Exactly one theme should be default.                       |
| `primary`   | `ThemeSwatch`                       | yes      | The main swatch.                                           |
| `secondary` | `ThemeSwatch`                       | no       | Optional additional swatch.                                |
| `tertiary`  | `ThemeSwatch`                       | no       | Optional additional swatch.                                |

A `ThemeSwatch` is `{ color, onColor, inkColor? }`:

- `color` - the fill: `default`, `hover`, `active`, `disabled` required, `focus` optional.
- `onColor` - content rendered on the fill: only `default` required; missing states fall back (`focus` → `hover` → `default`).
- `inkColor` - optional tinted text/border for transparent or tonal fills; same fallbacks as `onColor`.

Inside a color scope these tokens resolve (the un-suffixed variant is opacity-aware):

- `--et-theme-color-primary`, `--et-theme-color-primary-{rgb,solid,opacity}`
- `--et-theme-color-on-primary`, `--et-theme-color-on-primary-{rgb,solid,opacity}`
- `--et-theme-color-ink`, `--et-theme-color-ink-{rgb,solid,opacity}`

### Color directives

| Directive                            | Selector                        | What it does                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProvideColorDirective`              | `[etProvideColor]`              | Sets the color theme for the subtree. Accepts a registered name **or** a full `ColorTheme` object.                                                                                            |
| `ColorInteractiveDirective`          | `[etColorInteractive]`          | Re-resolves the color tokens per the host's own interaction state. Put it on the interactive element itself, never a wrapper.                                                                 |
| `ColorInteractiveContainerDirective` | `[etColorInteractiveContainer]` | Cascades hover/active state down to descendant `etColorInteractive` elements.                                                                                                                 |
| `ColorInteractiveExcludeDirective`   | `[etColorInteractiveExclude]`   | Marks a descendant as not triggering an ancestor's interactive reaction.                                                                                                                      |
| `ColorInteractiveHasFocusDirective`  | `[etColorInteractiveHasFocus]`  | Tints tokens to the **base** accent while the host contains a `:focus-visible` element - never on hover/active, and not the `-focus` variant (that is for an element that is itself focused). |

### The `surface` color

`surface` is a reserved color name, not a registered theme:

```html
<button et-button color="surface">Cancel</button>
<div etProvideColor="surface">…</div>
```

Inside that scope the color tokens resolve from the ambient surface's
[`interactionColor` swatch](#surface-themes) instead of an accent, so a secondary action reads as
chrome - and follows the surface it sits on, which a registered neutral theme cannot do. Every
component keeps its own structural signature; only the palette changes. Apps must not register a
color theme named `surface`.

The scope is emitted by the **surface** generator (it is the surface exposing itself as a color), so
an app needs to have run `nx g @ethlete/core:tailwind-4-surface-theme` since upgrading for
`color="surface"` to resolve.

### Offering colors to a user

A component that lets someone _pick_ a color needs more than the registry: `injectColorThemes()` returns every theme the app registered - including the ones nobody should choose by hand (`error`, `warning`) - and a `ColorTheme.name` is a slug, not a label to render. `provideColorPalette` is the curated, ordered, labelled slice:

```ts
import { provideColorPalette } from '@ethlete/core';

providers: [
  provideColorPalette([
    { token: 'brand', label: 'Team' },
    { token: 'ocean', label: 'Training' },
  ]),
];
```

`token` must name a registered theme; `label` is what a user reads next to the swatch, already translated. Provide it wherever the picker can see it - app-wide in `appConfig`, or on a single feature's component.

Nothing in the SDK requires a palette. A component reads it with `injectColorPalette({ optional: true })` and falls back to accepting a raw theme name when there is none - see the [scheduler's color field](/components/scheduler#fields).

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

`injectErrorTheme()`, `injectWarningTheme()` and `injectSuccessTheme()` return the registered `ColorTheme` with the matching `type` - and throw if the app hasn't registered one, so components can rely on them.

`injectDefaultColorTheme()` returns the registered `ColorTheme` with `isDefault: true` the same way - useful for a shared component with no themed ancestor to inherit from (a page-level `et-spinner`, say), where "the app's default accent" is the right fallback. It throws if no theme is marked `isDefault: true`.

## Legacy runtime theming

`provideColorThemes(themes)` (without the `WithTailwind4` suffix) is the previous, Tailwind-v3-era system: it injects `<style>` tags at runtime instead of generating CSS at build time. It - along with its helpers (`createThemeStyle`, `createTailwindColorThemes`, …) - is **deprecated** with intent to remove in v6. New apps should use the generator-based setup above.
