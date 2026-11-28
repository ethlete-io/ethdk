# Theming

`@ethlete/core` themes every Ethlete component with two runtime systems. A **surface** is the neutral level an
element sits on: a background, three text colors and a border, plus an integer `elevation` in a `light` or `dark`
family, so a nested panel picks the next level up by itself. A **tone** is the accent a component appears in (a
brand color, an error color, a team color): a fill, the text on that fill, and the tone as text. Hover and pressed
are not theme colors: a component mixes a translucent tint of its surface at its own strength, so the same
component works on every level without any setting. Your app registers the themes, generates their CSS at build
time, and sets them on a subtree with `etProvideSurface`, `etAutoSurface` and `etProvideColor`.

::: warning Theme names are yours, not the SDK's
The SDK defines **no** themes. Names like `brand`, `danger` or `dark-elevated` used below are just what this repo's
docs app and Storybook register - your app picks its own. Semantic behavior is addressed via the theme `type`
(e.g. `type: 'error'`), never by name.
:::

## Levels in action

The demo nests the root surface, a surface on it, and a card on that, and opens an overlay from the card at the top
level. Every level shows its theme name and its five values as the browser resolves them, and holds the same
components, so hover and pressed show on each level without any setting. The switches change the scheme, the tone,
and "hover = next level".

@example theming/theming-levels 2030px

The part of the demo that themes it - one tone on the root, one surface, and an `etAutoSurface` per level:

```html
<div [etProvideSurface]="rootSurface()" [etProvideColor]="tone()">
  <app-theming-level label="Root">
    <div etAutoSurface>
      <app-theming-level label="Surface">
        <div etAutoSurface>
          <app-theming-level label="Card">…</app-theming-level>
        </div>
      </app-theming-level>
    </div>
  </app-theming-level>
</div>
```

```css
/* "Hover = next level: on" */
.app-theming-stage[data-hover-next-level] et-accordion-group {
  --et-accordion-header-hover: var(--et-surface-next-background);
}
```

The dark levels it renders, as this docs app registers them:

<<< @/../docs-examples/src/app/surface-themes.ts#dark-levels

## How a component colors a state

Every hover, pressed, selected or checked look in `@ethlete/components` has one form: the surface tint, mixed at
the component's own strength over whatever lies below.

```css
.et-accordion-header:hover {
  background: var(
    --et-accordion-header-hover,
    color-mix(in srgb, var(--et-surface-tint, var(--et-surface-text, gray)) 7%, transparent)
  );
}
```

- **The tint** is the surface theme's `tint`. A theme without one inherits the tint of the surface around it, and
  where no surface sets one the state reads the surface text, so the fallback chain is part of the form.
- **The strength** (`7%` above) belongs to the component; each keeps the strength it shipped with.
- **The token** in front (`--et-accordion-header-hover`) is the component's override point. Set it on the
  component's element or a scope inside its surface, never on `:root`: a `var()` resolves where it is declared, so
  on `:root` every level would get the root's value.
- **The token name** is `--et-<component>[-<part>][-<variant>]-<state>[-<property>]`. The bare state names the
  background (`--et-select-option-hover`); any other property follows the state (`--et-tab-hover-color`,
  `--et-form-field-control-focus-border-color`, `--et-button-disabled-opacity`). The token still takes any color;
  prefer `var(--et-surface-next-background)` or leaving the strength to the component over a fixed color.
- **"Hover = next level"** is the same override with `var(--et-surface-next-background)`, as in the demo above. On
  the topmost level there is no next surface; the token then holds the tint mixed 9% over the background.

The [`ethlete/no-hand-mixed-state`](/eslint/rules#no-hand-mixed-state) lint rule enforces the form in component CSS:
it reports a tint read without the `--et-surface-text` fallback, a state mixed from `--et-surface-control-text`, and
a state background that is a static color.

Tones are not mixed: a filled button reads `--et-tone-fill-hover` and its siblings directly (see
[tone tokens](#tone-tokens)).

## State utilities

An app's own element gets the same feedback from one of two Tailwind utilities. Both resolve against the nearest
surface, so the same classes work on every level:

| Utility                                                   | Use it for                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| `hover:bg-et-surface-tint/9 active:bg-et-surface-tint/15` | A translucent tint over whatever lies below; set the strength.   |
| `hover:bg-et-surface-next-background`                     | "Hover = next level": the row takes the background one level up. |

```html
<li class="hover:bg-et-surface-tint/9 active:bg-et-surface-tint/15">Tinted row</li>
<li class="hover:bg-et-surface-next-background">Next-level row</li>
```

::: warning Not `hover:bg-et-surface-control-text-hover`
`--et-surface-control-text-hover` is a full-strength text color, not an overlay. As a hover background it paints a
near-white row in dark mode with near-white text on top. Use one of the two utilities above.
:::

Every [surface token](#surface-tokens) and [tone token](#tone-tokens) has a utility too: `text-et-surface-text-muted`,
`border-et-surface-border`, `bg-et-tone-fill`, `text-et-tone-text`. A registered theme also gets named ones, such as
`bg-et-surface-<name>-background` and `bg-et-tone-<name>-fill`.

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

The providers only make the themes known to Angular (for the directives and inject helpers). The CSS variables are
produced **at build time** by two Nx generators that read the same theme files:

```bash
yarn nx g @ethlete/core:tailwind-4-color-theme --themesPath=src/themes.ts
yarn nx g @ethlete/core:tailwind-4-surface-theme --themesPath=src/surface-themes.ts
```

- Each generator emits a `.css` file (import it in your global styles; default `generated-tailwind-themes.css` /
  `generated-tailwind-surface-themes.css` under `src/styles/`) and a `.d.ts` next to it that registers your theme
  names with TypeScript, so `etProvideColor` / `etProvideSurface` autocomplete them.
- The color generator adds one `true` member per theme name to the merge-only `EthleteColorThemeNames` interface,
  so several sheets can each register their own names. The older single `name: 'a' | 'b'` member of
  `EthleteColorThemeNameRegistry` still works but is deprecated, and two sheets using it conflict.
- Re-run the generator whenever the theme files change. The header comment of each generated file holds the exact
  command to regenerate it.
- The generators validate the definitions: exactly one `isDefault` color theme, one default surface per `type`, and
  no duplicate semantic `type`s. In dev mode, two defaults of the same surface `type`, or two default color themes,
  throw `ET9201` / `ET9200` naming both.
- Keep the definitions literal objects: the generators read the files statically. Color maps may spread consts
  (`{ ...ON_COLOR_DARK, disabled: '...' }`) declared in the themes file or imported from a relative file. A spread
  the generator cannot resolve (a package import, a missing file, a non-object value) is skipped with a warning
  naming the file and the spread, so the generated CSS lacks those colors until you inline them.
- Several apps sharing one definition set pick their default at the generation call instead:
  `--defaultTheme=<name>` (color) and `--defaultLightTheme=<name>` / `--defaultDarkTheme=<name>` (surface, per
  `type`) override any `isDefault` flags.
- Both provider factories and generators accept a custom prefix (default `'et'`); the provider `prefix` argument
  must match the generator's `runtimePrefix`.

In dev mode `etProvideColor` warns once when no color themes are registered, and
`provideSurfaceThemesWithTailwind4()` warns once the page has loaded if the root font size is still the browser
default - the SDK's `rem` sizes need `html { font-size: 62.5%; }`, see [Setup](/components/setup#styles).

### The root surface

The `isDefault` themes paint `:root`, so an app renders on its default surface without scoping one:

- **Both types** - the light default sits behind `@media (prefers-color-scheme: light)`, the dark one behind
  `dark`, and the root follows the user's OS preference.
- **One type** (a dark-only app) - the sole default lands on plain `:root`. Behind a media query the surface
  variables would be undefined for everyone whose OS asks for the scheme the app doesn't have.

Either way the block also sets `color-scheme`, so scrollbars and native controls match the surface.

### Switching light and dark

Add `provideColorScheme()` to let the user pick light or dark instead of the OS preference:

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideSurfaceThemesWithTailwind4(SURFACE_THEMES), provideColorScheme({ mode: 'system' })],
};
```

```ts
private colorScheme = injectColorScheme();

toggle() {
  this.colorScheme.setMode(this.colorScheme.type() === 'dark' ? 'light' : 'dark');
}
```

- `setMode('light' | 'dark')` puts `et-scheme--light` or `et-scheme--dark` on `<html>`. The generated
  `:root.et-scheme--<type>` rule paints that default and sets `color-scheme`, regardless of the OS.
- `setMode('system')` removes the class, and the media query decides again.
- If the root surface has a `colorThemeVariants` entry for the `isDefault` color theme, `<html>` also gets the
  `et-color--<variant>` class, and it follows the scheme.
- `mode()` is the mode the app asked for, and `type()` the `'light' | 'dark'` the root paints. In `system` mode,
  `type()` follows the OS live.
- A server render in `system` mode cannot know the OS scheme, so an `[etAutoSurface]` that elevates above the root
  surface renders `et-surface--inherited` there. The first paint follows the media query at root elevation, and
  the elevated surface appears on hydration. Inside an explicit surface it still elevates.

The mode does not persist. Store it yourself, and pass the stored value as `mode`. The rule exists only when the app
registers a default for both types. Hand-written CSS behind `@media (prefers-color-scheme: …)` does not follow the
class; select `:root.et-scheme--dark` there too.

### A dark-only app

The smallest complete setup: dark surfaces only, one per elevation the app stacks, one accent, and an error theme
(form fields resolve their error state through [`injectSemanticColorTheme('error')`](#semantic-themes) and throw
without one). Every name below is the app's own:

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
    tint: '255 255 255',
    controlText: { default: '255 255 255' },
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
    tint: '255 255 255',
    controlText: { default: '255 255 255' },
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

With a single `type`, the `page` surface lands on plain `:root` with `color-scheme: dark`. `[etAutoSurface]` inside
the page resolves `card`; register an `elevation: 2` surface as well if panels nest a level deeper.

## Reference

### Surface themes

A `SurfaceTheme` - all colors are `"R G B"` channel strings:

| Field                | Type                          | Required | Description                                                                                                          |
| -------------------- | ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| `name`               | `string`                      | yes      | Becomes the scope class `et-surface--<name>`.                                                                        |
| `type`               | `'light' \| 'dark'`           | yes      | The elevation family.                                                                                                |
| `elevation`          | `number`                      | yes      | Integer; `etAutoSurface` resolves `elevation + 1`.                                                                   |
| `isDefault`          | `boolean`                     | no       | Exactly one per `type`; paints `:root`.                                                                              |
| `background`         | `"R G B"`                     | yes      | Surface background.                                                                                                  |
| `color`              | `"R G B"`                     | yes      | Primary text.                                                                                                        |
| `colorMuted`         | `"R G B"`                     | yes      | Secondary text.                                                                                                      |
| `colorSubtle`        | `"R G B"`                     | yes      | Tertiary text.                                                                                                       |
| `border`             | `"R G B"`                     | yes      | Border color.                                                                                                        |
| `tint`               | `"R G B"`                     | no       | The source hover and pressed feedback mixes in. Unset: the surrounding surface's tint, else the surface text.        |
| `controlText`        | `"R G B"` per state           | no       | The text of a neutral control per state - see below.                                                                 |
| `colorThemeVariants` | `{ <chosen theme>: <theme> }` | no       | Swaps a chosen accent for a version that reads well on this surface - see [colors per surface](#colors-per-surface). |

`controlText` is the text of a neutral control per state
(`{ default, hover?, focus?, active?, disabled? }`); only `default` is required, a missing `focus` falls back to
`hover` and the rest to `default`. It is also the fill that [`etProvideColor="surface"`](#the-surface-color)
resolves, with the surface background as the text on it. Its ladder should escalate towards the surface text.

`elevation` may be negative: write `elevation: -1` as a literal; the generator fails, naming the theme, when it
cannot read one. Filled form fields, table card rows and grid items resolve `parent.elevation + 1`, so under a `-1`
surface they resolve `0`. A toast and an `@ethlete/cdk` overlay with a backdrop always resolve elevation `1`; a cdk
overlay without a backdrop resolves `parent.elevation + 1`. When a theme matches, the overlay's scope class changes
from `et-surface--inherited` to `et-surface--<theme>`. `@ethlete/cdk` CSS reads no `--et-surface-*` token, so
`etProvideSurface` on a cdk host does nothing.

A resolved elevation is an exact match and stays on the inherited scope when no theme sits at that level. So
**adding a level to an existing app changes UI without any template edit**. Once an elevation-`1` theme of a type
is registered, every overlay with a backdrop (components and cdk) and every toast switches to it; under an
elevation-`0` surface, filled form fields, table card rows, grid items, `[etAutoSurface]` panels (menu, select,
tooltip and the other pickers) and overlays without a backdrop switch as well. To add a level without a visible
change, copy every token except the background from the level below, then change the rest on purpose.

### Surface tokens

Inside any surface scope and on `:root`, each a ready color:

| Token                                                         | Value                                                                                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `--et-surface-background`                                     | The background.                                                                                                                          |
| `--et-surface-text`                                           | Primary text.                                                                                                                            |
| `--et-surface-text-muted`, `--et-surface-text-subtle`         | Secondary and tertiary text.                                                                                                             |
| `--et-surface-border`                                         | Borders and separators.                                                                                                                  |
| `--et-surface-tint`                                           | The state tint, only where a theme sets `tint`; read it in [the state form](#how-a-component-colors-a-state).                            |
| `--et-surface-control-text`, `-{hover,focus,active,disabled}` | The text of a neutral control per state, where a theme sets `controlText`. Never a background.                                           |
| `--et-surface-next-background`                                | The background of the registered surface with `elevation + 1` in the same `type`; on the topmost level, the tint 9% over the background. |

### Color themes

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
- `onColor` - content on the fill: only `default` required; a missing `hover` falls back to `default`, `focus` to
  `hover`, and `active` and `disabled` to `default`.
- `inkColor` - the tone as text or border on the normal surface (an outline button, a link), for a fill with too
  little contrast as text; same fallbacks as `onColor`, and `default` falls back to the fill's `default`.

### Tone tokens

Inside a color scope (the nearest `etProvideColor`, else the `isDefault` theme), each a ready color:

| Token                                                      | Value                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------- |
| `--et-tone-fill`, `-{rest,hover,focus,active,disabled}`    | The tone as a fill (a filled button), from `color`.         |
| `--et-tone-on-fill`, `-{rest,hover,focus,active,disabled}` | Text and icons on that fill, from `onColor`.                |
| `--et-tone-text`, `-{rest,hover,focus,active,disabled}`    | The tone as text or border on the surface, from `inkColor`. |

The unsuffixed name follows the state of an `[etColorInteractive]` element; the suffixed ones are fixed. The
generated CSS also records a color theme's `type` as `--et-color-theme-type` and a surface's `colorThemeVariants` as
`--et-surface-color-theme-variants`; the runtime ignores both, the `et design` frames read them.

### Directives

| Directive                            | Selector                        | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProvideSurfaceDirective`            | `[etProvideSurface]`            | Sets the surface for the subtree: `<div etProvideSurface="dark">`. Without a value, inherits the parent surface.                                                                                                                                                                                                                                                                                                                                                |
| `AutoSurfaceDirective`               | `[etAutoSurface]`               | Picks the registered surface with the parent's `elevation + 1` in the same `type`. With no provider above it, the parent is the [root surface](#the-root-surface). Inside an overlay it elevates above the overlay's surface (matched by DOM containment), while auto-surfaces on the base page stay as they are. An overlay panel that _is_ the overlay's surface calls `matchOverlaySurface()` to paint the overlay's elevation instead of stacking above it. |
| `ProvideColorDirective`              | `[etProvideColor]`              | Sets the color theme for the subtree. Accepts a registered name, `surface` (see [below](#the-surface-color)), **or** a full `ColorTheme` object.                                                                                                                                                                                                                                                                                                                |
| `ColorInteractiveDirective`          | `[etColorInteractive]`          | Re-resolves the unsuffixed tone tokens per the host's own interaction state. Put it on the interactive element itself, never a wrapper.                                                                                                                                                                                                                                                                                                                         |
| `ColorInteractiveContainerDirective` | `[etColorInteractiveContainer]` | Cascades hover/active state down to descendant `etColorInteractive` elements.                                                                                                                                                                                                                                                                                                                                                                                   |
| `ColorInteractiveExcludeDirective`   | `[etColorInteractiveExclude]`   | Marks a descendant as not triggering an ancestor's interactive reaction.                                                                                                                                                                                                                                                                                                                                                                                        |
| `ColorInteractiveHasFocusDirective`  | `[etColorInteractiveHasFocus]`  | Tints tokens to the **base** accent while the host contains a `:focus-visible` element - never on hover/active, and not the `-focus` variant.                                                                                                                                                                                                                                                                                                                   |

### Injectors

| Function                                              | Returns                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `injectSurfaceThemes()`, `injectColorThemes()`        | Every registered theme.                                                                                     |
| `injectColorScheme()`                                 | The scheme switch of [`provideColorScheme()`](#switching-light-and-dark).                                   |
| `injectSemanticColorTheme(type)`                      | A signal with the theme of that `type`, swapped for the surface - see [semantic themes](#semantic-themes).  |
| `injectDefaultColorTheme()`                           | The `isDefault` color theme; throws without one. A fallback for a shared component with no themed ancestor. |
| `injectColorPalette()`, `injectSurfaceColorPalette()` | The curated palette - see [offering colors to a user](#offering-colors-to-a-user).                          |

A `ProvideSurfaceDirective` with nothing above it and no surface set resolves the default, so a single-scheme app's
`elevation()` and `surfaceType()` describe its real root surface. A nested provider left unset paints nothing but
reports what it inherits: `activeTheme()` walks up to the closest provider that resolves a surface.

### The `surface` color

`surface` is a reserved color name, not a registered theme:

```html
<button et-button color="surface">Cancel</button>
<div etProvideColor="surface">…</div>
```

Inside that scope the tone tokens resolve from the ambient surface's [`controlText`](#surface-themes), so a
secondary action reads as chrome and follows the surface it sits on, which a registered neutral theme cannot do.
Apps must not register a color theme named `surface`. The scope is emitted by the **surface** generator, so
regenerate the surface CSS after an upgrade.

### Semantic themes

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

`injectSemanticColorTheme('error' | 'warning' | 'success')` returns a signal of the registered `ColorTheme` with
the matching `type`, and reading it throws if the app hasn't registered one, so components can rely on it. Every SDK
component resolves its semantic colors through it: the form field's error and warning states, select, cascader,
menu, alert dialog, table, match card, bracket pick card, rich text editor popup, banner, progress step, stat tile
and the query devtools.

### Colors per surface

A surface is where an element sits; a tone is an accent you choose. A surface can swap an accent for a version that
reads well on it with `colorThemeVariants`. The keys and the values are color theme names:

```ts
// The app's own names
export const LIGHT_SURFACE: SurfaceTheme = {
  name: 'light',
  type: 'light',
  elevation: 0,
  colorThemeVariants: {
    brand: 'brand-on-light',
    danger: 'danger-on-light',
    success: 'success-on-light',
    grey: 'grey-light',
  },
  // …
};
```

A color resolves in two steps:

1. Find the chosen accent: the nearest `[etProvideColor]`, else the `isDefault` theme. For
   `injectSemanticColorTheme(type)`, the theme with that `type`.
2. If the nearest surface has an entry for the chosen accent, use that entry. Else use the chosen accent.

The swap always starts from the chosen accent, never from a swapped one, so a dark surface inside a light one draws
`brand` again without an entry of its own. An `[etProvideColor]` above a surface is swapped inside it too. Register a
variant as an ordinary color theme without a `type`, so the type lookup stays unambiguous.

| You want                                         | Use                                                 |
| ------------------------------------------------ | --------------------------------------------------- |
| A neutral color that follows the surface         | `color="surface"`, values from `controlText`        |
| An accent with a better version on some surfaces | `color="<name>"`, plus `colorThemeVariants` entries |
| An accent that stays the same on every surface   | `color="<name>"`, with no entry                     |

Content in an overlay panel follows the surface the panel paints, not the one its trigger sits on. Where no surface
sits above, the default root surface swaps. `:root` has no surface element, so `provideColorScheme()` paints the swap
of the default accent on `<html>`. Without it, put an `[etProvideSurface]` at the app root.

### Offering colors to a user

A component that lets someone _pick_ a color needs more than the registry: `injectColorThemes()` returns every
theme the app registered - including the ones nobody should choose by hand (`error`, `warning`) - and a
`ColorTheme.name` is a slug, not a label to render. `provideColorPalette` is the curated, ordered, labelled slice:

```ts
import { provideColorPalette } from '@ethlete/core';

providers: [
  provideColorPalette([
    { token: 'brand', label: 'Team' },
    { token: 'ocean', label: 'Training' },
  ]),
];
```

`token` must name a registered theme; `label` is what a user reads next to the swatch, already translated. Provide
it wherever the picker can see it - app-wide in `appConfig`, or on a single feature's component.

A palette tuned for a light surface can lose contrast on a dark one. Pass one list per registered surface theme name
instead, plus a `default` list for every other surface:

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

Keep the same order in every list: the position is what ties a series to its color. The charts read
`injectSurfaceColorPalette()`, a signal of the list for the surface they sit on. `injectColorPalette()` always
returns the `default` list, so a color picker stores the same token on every surface. Nothing in the SDK requires a
palette: a component reads it with `injectColorPalette({ optional: true })` and falls back to a raw theme name - see
the [scheduler's color field](/components/scheduler#fields).

### Categorical colors

A categorical color is a registered color theme with no `type`, and the palette above is the app's categorical
order. Register one theme per category (a product, a team, a data series) and address a single category by its
theme name where it owns its color:

```html
<!-- `product-pro` is one of this app's registered themes -->
<et-badge color="product-pro">Pro</et-badge>
```

The charts take a per-series `colorToken` - see [chart series colors](/components/chart#series-colors). In CSS, the
category's color is `--et-tone-fill` under that scope; never repeat its hex value in a stylesheet.

### Shadow and scrim colors

Shadows and scrims sit behind or over a surface and are not part of a theme. Three tokens set their base color, and
each component keeps its own opacity on top:

| Token                 | Default            | Read by                                                                                                                                                                                                                                                                |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--et-shadow-color`   | `rgb(0 0 0)`       | Every component shadow: the anchored panels (menu, select, cascader, color picker, date picker, rich-text popups) while `--et-anchored-panel-shadow` is unset, tooltip, toggletip, `elevated` card, `enclosed` table, fab, slider thumbs, notification, scheduler drag |
| `--et-scrim-color`    | `rgb(0 0 0)`       | The overlay backdrop (`/ 0.32`), the dropzone preview's info bar (`/ 0.6`)                                                                                                                                                                                             |
| `--et-on-scrim-color` | `rgb(255 255 255)` | Text on a scrim - the dropzone preview's file name and size                                                                                                                                                                                                            |

They are ready colors, so apply an alpha with `color-mix()`. They are not generated with the themes; set them on
`:root` or on any scope:

```css
:root {
  --et-shadow-color: rgb(15 23 42);
}
```

## Migrating

`et update` runs the required theming migrations for you; regenerate the theme CSS afterwards. A run scoped with
`--projects` or an `--include` directory rewrites the Studio design files in `.ethlete/design` too; a run with only
`--include <file>` paths changes just those files.

- `@ethlete/core:migrate-theme-token-names` renames the old tokens (the `-rgb` / `-solid` surface names,
  `--et-surface-color*`, `--et-theme-color-*`, `--et-color-primary*`, and the matching Tailwind utilities) to the
  names above.
- `@ethlete/core:migrate-surface-roles` splits `interactionColor`: its `color.default` becomes `tint` and its
  `color` map becomes `controlText`; `onColor` and `inkColor` are gone. It also rewrites the readers of the old
  `--et-surface-interaction*` tokens.
- `@ethlete/core:migrate-remove-surface-interactive` drops the removed `[etSurfaceInteractive]` attribute, the
  `et-surface-interactive` class and the directive imports, and lists a stylesheet selector on the class for a hand
  fix.

A case a migration cannot rewrite safely stays as it is and comes back as a `file:line` finding with a reason. Fix
each by hand, regenerate the theme files, and run the migration again until it reports nothing. The token rename
prints its findings as a `WARN` list and exits 0, so the later migrations still run. It reports three kinds:

**A name inside a larger string.** A string whose whole content is one old name is renamed. A name that is only part
of a string or a template string is reported as `old theme token left: <name>`:

```ts
// before
const name = `--et-theme-color-primary-${state}`;
const base = '--et-color-primary' + suffix;
```

Write the new name yourself: `--et-tone-fill` replaces `--et-theme-color-primary`, and `--et-tone-fill-rest` /
`--et-tone-fill-<state>` replace `--et-color-primary` and `--et-color-primary-<state>`. A string that builds a name
from a bare `--et-color-` prefix, such as `` `--et-color-${tone}` ``, is not reported at all: search for it.

**Two old names that merge into one.** `--et-surface-border` and `--et-surface-border-solid` both become
`--et-surface-border`. When one block sets both with different values, the finding is
`--et-surface-border and --et-surface-border-solid are both set here and merge into --et-surface-border: keep one by hand`.
Keep one declaration with the colour value:

```css
/* before */
a {
  --et-surface-border: var(--et-surface-color-subtle);
  --et-surface-border-solid: var(--app-line);
}

/* after */
a {
  --et-surface-border: var(--app-line);
}
```

**An old RGB triplet read outside `rgb()`.** The old `--et-surface-color` held a triplet like `255 255 255`; its
replacement `--et-surface-text` holds a full colour. A read inside `rgb()` is rewritten, but a read in `color-mix()`,
a Sass function or a concatenation is reported as
`--et-surface-color is a triplet read outside rgb() (in --_x): check every reader by hand`. Read the new token
directly:

```css
/* before */
a {
  --_x: color-mix(in srgb, var(--et-surface-color) 50%, transparent);
}

/* after */
a {
  --_x: color-mix(in srgb, var(--et-surface-text) 50%, transparent);
}
```

### Migrating from runtime theming

`provideColorThemes(themes)` (without the `WithTailwind4` suffix) was the previous, Tailwind-v3-era system: it
injected `<style>` tags at runtime instead of generating CSS at build time. It is removed, along with its helpers
(`createThemeStyle`, `createTailwindColorThemes`, ...), the deprecated `injectErrorTheme()`, `injectWarningTheme()` and
`injectSuccessTheme()` (use `injectSemanticColorTheme()`), and the deprecated `SurfaceTheme.colorTheme` and
`semanticColorThemes` (use `colorThemeVariants`). `et update` migrates them: `legacy-color-themes` and
`migrate-semantic-color-theme-injects` are required from `5.0.0-next.81`.

The theme data carries over: a legacy `ColorTheme` (RGB triplets, `isDefault`) is the type the generators read.
`yarn nx g @ethlete/core:migrate-legacy-color-themes` does step 2 and writes the rest as a checklist: it rewrites
every `provideColorThemes(X)` into `provideColorThemesWithTailwind4(X)`, fixes the import, and lists in
`legacy-color-themes-migration-tasks.md` the generator run per call site, the Tailwind 3 helpers left in a config,
and the surface themes to add. Pass `--projects` or `--include <path prefix>` to migrate one app at a time.
[`et migrations`](/cli/update#migration-levels) lists it as the recommended assisted migration
`core:legacy-color-themes`; `yarn et migrations run core:legacy-color-themes` runs it and leaves the checklist as a
task for an agent.

1. **Tailwind 3 → 4.** Delete the `tailwind.config.ts` color block built from `createTailwindColorThemes(THEMES, 'gg')`. Run the color generator on the same theme file with the same prefix; it emits the same `bg-gg-<name>`, `bg-gg-<name>-hover`, `text-gg-on-<name>` utilities through `@theme`:

   ```bash
   yarn nx g @ethlete/core:tailwind-4-color-theme --themesPath=libs/theme/src/themes.ts --prefix=gg
   ```

   `--prefix` names the utilities, and the runtime variables and scope classes follow it (`--gg-*`) unless you also pass `--runtimePrefix`. The legacy runtime always used `--et-*`, so pass `--runtimePrefix=et` to keep it - the provider's `prefix` argument must match.

2. **Providers.** `provideColorThemes(THEMES)` becomes `provideColorThemesWithTailwind4(THEMES)`. The runtime `<style>` injection goes away; import the generated `.css` in the global stylesheet instead.

3. **Surface themes.** A legacy app has none, and every component reads its backgrounds, text and borders from one. Start with one `light` surface (`isDefault: true`, elevation 0) built from the app's existing page background, text, muted text and border colors, plus a `light-elevated` one for cards and overlays. Add `dark` surfaces only if the app has a dark mode. Generate them with `tailwind-4-surface-theme` and register them with `provideSurfaceThemesWithTailwind4()` - see [Surface themes](#surface-themes).

4. **The app's own CSS.** The primary swatch is emitted on every `.et-color--<name>` scope as the [tone tokens](#tone-tokens). Read those instead of `rgb(var(--et-color-primary))`. The `secondary` and `tertiary` swatches keep their `--et-color-*` names, and the `--et-color-alt-*` variables of the alternate theme are not emitted: put the region in its own `etProvideColor` scope and read `--et-tone-fill` there.

The runtime directives (`etProvideColor`, `injectColorThemes()`) work the same under both setups. `migrate-to-v5` renames the old `theme` names to `color` but leaves `provideColorThemes` in place: `et update` migrates that call.
