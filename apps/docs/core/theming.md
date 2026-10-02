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

Color maps may spread consts (`{ ...ON_COLOR_DARK, disabled: '...' }`). The color generator resolves a spread of a const declared in the themes file or imported from a relative file it can read from the workspace. A spread it cannot resolve - a package import, a missing file, or a value that is not an object literal - is skipped with a warning naming the file and the spread, so the generated CSS lacks those colors until you inline them.

When several apps share one theme definition set (a monorepo) but need different defaults, pick the default at the generation invocation instead of in the definitions: `--defaultTheme=<name>` (color generator) and `--defaultLightTheme=<name>` / `--defaultDarkTheme=<name>` (surface generator, per surface `type`) make the named theme the default, overriding any `isDefault` flags - the definitions then don't need `isDefault` at all.

In dev mode `provideSurfaceThemesWithTailwind4()` also warns once the page has loaded if the root font size is still the browser default - the SDK's `rem` sizes need `html { font-size: 62.5%; }`, see [Setup](/components/setup#styles).

Both provider factories and generators accept a custom prefix (default `'et'`); the provider `prefix` argument must match the generator's `runtimePrefix`.

For code that needs to know the currently active surface (e.g. pickers rendering into overlays), `provideSurfaceContextTracker()` / `injectSurfaceContextTracker()` maintain a registration stack of surface `type` + `elevation` - each open overlay registers its own surface together with its pane element. `surfaceForElement(host)` returns the surface of the innermost overlay whose pane actually **contains** `host` in the DOM, or `null` when `host` sits outside every open overlay. `AutoSurfaceDirective` uses it so opening an overlay only affects auto-surfaces rendered inside it - see below. A layer that renders outside every pane (the notification stack) resolves its own surface instead of following what is open, so it never re-shades while it is on screen.

## Surface themes

A `SurfaceTheme` - all colors are `"R G B"` channel strings:

| Field                 | Type                             | Required | Description                                                                                                                     |
| --------------------- | -------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `name`                | `string`                         | yes      | Becomes the scope class `et-surface--<name>`.                                                                                   |
| `type`                | `'light' \| 'dark'`              | yes      | The elevation family.                                                                                                           |
| `elevation`           | `number`                         | yes      | Integer; auto-surface resolves `elevation + 1`.                                                                                 |
| `isDefault`           | `boolean`                        | no       | Exactly one per `type`; paints `:root`.                                                                                         |
| `background`          | `"R G B"`                        | yes      | Surface background.                                                                                                             |
| `color`               | `"R G B"`                        | yes      | Primary text.                                                                                                                   |
| `colorMuted`          | `"R G B"`                        | yes      | Secondary text.                                                                                                                 |
| `colorSubtle`         | `"R G B"`                        | yes      | Tertiary text.                                                                                                                  |
| `border`              | `"R G B"`                        | yes      | Border color.                                                                                                                   |
| `interactionColor`    | swatch                           | no       | The surface's neutral swatch - see below.                                                                                       |
| `semanticColorThemes` | `{ success?, warning?, error? }` | no       | The color theme serving each semantic `type` on this surface - see [semantic themes per surface](#semantic-themes-per-surface). |
| `colorTheme`          | color theme name                 | no       | The color theme the surface element applies to its subtree - see [a default color per surface](#a-default-color-per-surface).   |

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
returns a signal with the `'light' | 'dark'` a subtree renders on, or `null` when no surface can be resolved: the surrounding provider's type,
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

### A dark-only app

The smallest complete setup: dark surfaces only, one per elevation the app stacks, one accent, and an error theme (form fields resolve their error state through [`injectSemanticColorTheme('error')`](#semantic-themes-per-surface) and throw without one). Every name below is the app's own:

```ts
// surface-themes.ts
export const SURFACE_THEMES = [
  {
    name: 'page',
    type: 'dark',
    elevation: 0,
    isDefault: true,
    background: '18 18 18',
    color: '255 255 255',
    colorMuted: '163 163 163',
    colorSubtle: '115 115 115',
    border: '64 64 64',
    interactionColor: {
      color: {
        default: '255 255 255',
        hover: '255 255 255',
        focus: '255 255 255',
        active: '255 255 255',
        disabled: '255 255 255',
      },
    },
  },
  {
    name: 'card',
    type: 'dark',
    elevation: 1,
    background: '30 30 30',
    color: '255 255 255',
    colorMuted: '163 163 163',
    colorSubtle: '115 115 115',
    border: '64 64 64',
    interactionColor: {
      color: {
        default: '255 255 255',
        hover: '255 255 255',
        focus: '255 255 255',
        active: '255 255 255',
        disabled: '255 255 255',
      },
    },
  },
] satisfies SurfaceTheme[];

// themes.ts
export const THEMES = [
  {
    name: 'accent',
    isDefault: true,
    primary: {
      color: { default: '0 200 150', hover: '0 180 135', active: '0 160 120', disabled: '0 80 60' },
      onColor: { default: '0 20 20' },
    },
  },
  {
    name: 'error',
    type: 'error',
    primary: {
      color: { default: '255 88 88', hover: '235 80 80', active: '215 70 70', disabled: '120 40 40' },
      onColor: { default: '0 20 20' },
    },
  },
] satisfies ColorTheme[];
```

Keep the definitions literal objects: the generators read the files statically, without running them. Register both and run both generators as in [Registering themes](#registering-themes). With a single `type`, the `page` surface lands on plain `:root` and `color-scheme: dark` comes with it - there is no light counterpart to write. `[etAutoSurface]` inside the page resolves `card`; register an `elevation: 2` surface as well if panels nest a level deeper.

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

A palette tuned for a light surface can lose contrast on a dark one. Pass one list per registered surface theme name instead, plus a `default` list for every other surface:

```ts
provideColorPalette({
  default: [
    { token: 'ocean', label: 'Training' },
    { token: 'forest', label: 'Match' },
  ],
  // `dark-card` and the `-bright` themes are this example app's own registrations
  'dark-card': [
    { token: 'ocean-bright', label: 'Training' },
    { token: 'forest-bright', label: 'Match' },
  ],
});
```

Keep the same order in every list: the position is what ties a series to its color. The charts read `injectSurfaceColorPalette()`, a signal of the list for the surface they sit on. `injectColorPalette()` always returns the `default` list, so a color picker stores the same token on every surface.

Nothing in the SDK requires a palette. A component reads it with `injectColorPalette({ optional: true })` and falls back to accepting a raw theme name when there is none - see the [scheduler's color field](/components/scheduler#fields).

### Categorical colors

There is no separate categorical-color system: a categorical color is a registered color theme with no `type`, and the palette above is the app's categorical order. Register one theme per category (a product, a team, a data series), list them in `provideColorPalette` where the order is what matters, and address a single category by its theme name where the category owns its color:

```html
<!-- `product-pro` is one of this app's registered themes -->
<et-badge color="product-pro">Pro</et-badge>
```

The charts read the palette for series order and take a per-series `colorToken` - see [chart series colors](/components/chart#series-colors). Inside CSS, the category's color is `--et-theme-color-primary-solid` under that scope; never repeat its hex value in a stylesheet.

## Shadow and scrim colors

Shadows and scrims are not part of a surface or color theme - they sit behind or over one. Three
channel tokens set their base color, and each component keeps its own opacity on top:

| Token                     | Default       | Read by                                                                                                                                                                                                                                                                |
| ------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--et-shadow-color-rgb`   | `0 0 0`       | Every component shadow: the anchored panels (menu, select, cascader, color picker, date picker, rich-text popups) while `--et-anchored-panel-shadow` is unset, tooltip, toggletip, `elevated` card, `enclosed` table, fab, slider thumbs, notification, scheduler drag |
| `--et-scrim-color-rgb`    | `0 0 0`       | The overlay backdrop (`/ 0.32`), the dropzone preview's info bar (`/ 0.6`)                                                                                                                                                                                             |
| `--et-on-scrim-color-rgb` | `255 255 255` | Text on a scrim - the dropzone preview's file name and size                                                                                                                                                                                                            |

They are raw `R G B` channels, like the `-rgb` surface tokens, so an alpha can be applied to them.
Neither is generated with the themes; set them on `:root` or on any scope:

```css
:root {
  --et-shadow-color-rgb: 15 23 42;
}
```

## Semantic themes

Because names are app-defined, code that needs "the error color" resolves it by `type`:

```ts
import { injectSemanticColorTheme } from '@ethlete/core';

@Component({
  template: `<span [etProvideColor]="errorTheme()">…</span>`,
})
export class ViolationHintComponent {
  errorTheme = injectSemanticColorTheme('error');
}
```

`injectSemanticColorTheme('error' | 'warning' | 'success')` returns a signal of the registered `ColorTheme` with the matching `type`, and reading it throws if the app hasn't registered one, so components can rely on it. `injectErrorTheme()`, `injectWarningTheme()` and `injectSuccessTheme()` are deprecated: they return the theme once and ignore the surface.

### Semantic themes per surface

One `inkColor` cannot read well on both a dark and a light surface. Register a second, ordinary color theme
for the other surface - without a `type`, so the type lookup stays unambiguous - and let the surface name it:

```ts
// The app's own names
export const SUCCESS_ON_LIGHT_THEME: ColorTheme = {
  name: 'success-on-light',
  primary: { color: { … }, onColor: { … }, inkColor: { default: '22 101 52' } },
};

export const LIGHT_SURFACE: SurfaceTheme = {
  name: 'light',
  type: 'light',
  elevation: 0,
  semanticColorThemes: { success: 'success-on-light', error: 'danger-on-light' },
  // …
};
```

`injectSemanticColorTheme(type)` returns a signal of the theme the nearest surface names for `type`, else
the registered theme of that `type`. It follows the surface through nesting, overlays that sync their
surface, and runtime changes. Reading it throws where the app registered no theme of that `type`.

```ts
export class DeltaComponent {
  successTheme = injectSemanticColorTheme('success'); // [etProvideColor]="successTheme()"
}
```

Every SDK component resolves its semantic colors this way: the form field's error and warning states,
select, cascader, menu, alert dialog, table, match card, bracket pick card, rich text editor popup, banner,
progress step, stat tile and the query devtools. Content in an overlay panel follows the surface the panel
paints, not the one its trigger sits on. The surface only picks which `.et-color--<name>` class an
element gets: CSS that reads `--et-theme-color-ink-solid` from an outer `.et-color--<name>` scope keeps
that scope's theme until something re-provides the color.

### A default color per surface

The same problem hits the default color theme: a brand ink tuned for a dark surface can fail contrast on a light
one. Register a darker variant and name it as the surface's `colorTheme`:

```ts
export const LIGHT_SURFACE: SurfaceTheme = {
  name: 'light',
  type: 'light',
  elevation: 0,
  colorTheme: 'brand-on-light', // the app's own name
  // …
};
```

Each `[etProvideSurface]` that resolves this surface adds `.et-color--brand-on-light` to its element, so its
subtree, and an overlay panel that syncs the surface, draws in that theme. A provider left unset inherits the class
from its parent. An `[etProvideColor]` with a color on the surface element or on an ancestor wins, so a surface
never resets a themed region. A surface without `colorTheme` keeps the color of its parent; when you set it on one
surface, set it on every surface the first can contain, or a dark surface inside a light one keeps the light
variant. `:root` has no surface element, so the default surface's `colorTheme` needs an `[etProvideSurface]` at
the app root.

`injectDefaultColorTheme()` returns the registered `ColorTheme` with `isDefault: true` the same way - useful for a shared component with no themed ancestor to inherit from (a page-level `et-spinner`, say), where "the app's default accent" is the right fallback. It throws if no theme is marked `isDefault: true`.

## Legacy runtime theming

`provideColorThemes(themes)` (without the `WithTailwind4` suffix) is the previous, Tailwind-v3-era system: it injects `<style>` tags at runtime instead of generating CSS at build time. It - along with its helpers (`createThemeStyle`, `createTailwindColorThemes`, …) - is **deprecated** with intent to remove in v6. New apps should use the generator-based setup above.

### Migrating from runtime theming

The theme data carries over: a legacy `ColorTheme` (RGB triplets, `isDefault`) is the type the generators read. The setup around it changes:

1. **Tailwind 3 → 4.** Delete the `tailwind.config.ts` color block built from `createTailwindColorThemes(THEMES, 'gg')`. Run the color generator on the same theme file with the same prefix; it emits the same `bg-gg-<name>`, `bg-gg-<name>-hover`, `text-gg-on-<name>` utilities through `@theme`:

   ```bash
   yarn nx g @ethlete/core:tailwind-4-color-theme --themesPath=libs/theme/src/themes.ts --prefix=gg
   ```

   `--prefix` names the utilities; the runtime variables keep `--et-*` unless you also pass `--runtimePrefix`.

2. **Providers.** `provideColorThemes(THEMES)` becomes `...provideColorThemesWithTailwind4(THEMES)`. The runtime `<style>` injection goes away; import the generated `.css` in the global stylesheet instead.

3. **Surface themes.** A legacy app has none, and every component reads its backgrounds, text and borders from one. Start with one `light` surface (`isDefault: true`, elevation 0) built from the app's existing page background, text, muted text and border colors, plus a `light-elevated` one for cards and overlays. Add `dark` surfaces only if the app has a dark mode. Generate them with `tailwind-4-surface-theme` and register them with `provideSurfaceThemesWithTailwind4()` - see [Surface themes](#surface-themes).

4. **The app's own CSS.** `--et-color-primary`, `--et-color-on-primary`, `--et-color-primary-ink` and their `-hover`/`-focus`/`-active`/`-disabled` states (also for `secondary` and `tertiary`) are still emitted on every `.et-color--<name>` scope, as `"R G B"` channels, so `rgb(var(--et-color-primary))` keeps working. The `--et-color-alt-*` variables of the alternate theme are not emitted: put the region in its own `etProvideColor` scope and read `--et-color-primary` there. `--et-theme-color-primary` is the opacity-aware form of the same color.

The runtime directives (`etProvideColor`, `injectColorThemes()`) work the same under both setups. `migrate-to-v5` renames the old `theme` names to `color` but leaves `provideColorThemes` in place: that call is the step above.
