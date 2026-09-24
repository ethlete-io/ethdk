# App setup

The one-time wiring an application needs before `@ethlete/components` renders correctly. Work
through it top to bottom when you start a new app; each item says what breaks without it.

```ts
import { provideColorThemesWithTailwind4, provideLocale, provideSurfaceThemesWithTailwind4 } from '@ethlete/core';
import {
  provideDateFormat,
  provideDateLocale,
  provideOverlay,
  providePaginationLabels,
  provideTableLabels,
} from '@ethlete/components';
import { de } from 'date-fns/locale';
import { COLOR_THEMES } from './theme/color-themes';
import { SURFACE_THEMES } from './theme/surface-themes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
    provideColorThemesWithTailwind4(COLOR_THEMES),
    provideOverlay(),
    provideLocale('de'),
    provideDateLocale(de),
    provideDateFormat('yyyy-MM-dd'),
    provideTableLabels({ empty: 'Keine Ergebnisse.' }),
    providePaginationLabels({ next: 'Nächste Seite' }),
  ],
};
```

## Styles

- **Root font size 62.5%.** Every SDK size is in `rem` against a 10px root (`1rem = 10px`,
  so `1.4rem` means 14px). At the browser default of 16px every control renders 1.6× too
  large. Put it in your global stylesheet:

  ```css
  @layer base {
    html {
      font-size: 62.5%;
    }
  }
  ```

  Size your own text in `rem` on the same 10px scale (or in `px`).

- **Tailwind CSS v4.** The theme generators emit Tailwind 4 CSS (`@theme` blocks and
  utilities), and component styles sit in `@layer components` so utilities can override
  them - see [Overriding component styles](/components/#overriding-component-styles).
  `@import 'tailwindcss';` comes first in the global stylesheet.
- **Generated theme CSS imported.** Define themes in TypeScript, then generate the CSS and
  the `.d.ts` that types your theme names ([Theming](/core/theming)):

  ```bash
  yarn nx g @ethlete/core:tailwind-4-surface-theme --themesPath=src/theme/surface-themes.ts
  yarn nx g @ethlete/core:tailwind-4-color-theme --themesPath=src/theme/color-themes.ts
  ```

  Import both generated `.css` files in the global stylesheet after Tailwind, and re-run the
  generators whenever a theme file changes.

## Theming providers (`@ethlete/core`)

- **`provideSurfaceThemesWithTailwind4(themes)`** - the neutral surfaces (backgrounds, text,
  borders) components resolve from. One `isDefault` surface per `type` (`'light'` / `'dark'`).
- **`provideColorThemesWithTailwind4(themes)`** - the accent palettes. Exactly one
  `isDefault` theme. Pass the same arrays you ran the generators on.
- **A color theme with `type: 'error'`.** `et-form-field`, `et-select` and `et-cascader`
  resolve their error styling through `injectErrorTheme()`, which throws
  `No color theme with type "error" found` when none is registered - so every form control
  fails without it. Register `type: 'warning'` too if you use form warnings, and
  `'success'` / `'warning'` / `'error'` for `et-progress-steps` states.

Theme names (`brand`, `neongreen`, …) are yours to choose; the SDK ships none. Semantic behavior
only ever looks up the `type`.

## Component providers (`@ethlete/components`)

- **`provideOverlay()`** - once at bootstrap, before any dialog, sheet, menu, select or
  tooltip opens. Registers the scroll blocker that locks body scroll while an overlay is
  open ([Overlays](/components/overlays#setup)).
- **`provideDateLocale(locale)`** - the date-fns locale for month and weekday names,
  calendars, and parsing typed dates. It does not follow `provideLocale()`; without it dates
  stay en-US ([Localization](/components/localization#_2-the-date-fns-locale)).
- **`provideDateFormat(format)`** - only if your API does not speak the default wire format
  `yyyy-MM-dd'T'HH:mm:ssxxx`. It is the string date controls read and write, e.g.
  `'yyyy-MM-dd'` for calendar-day filters. `provideTimeFormat(format)` does the same for time
  controls (default `HH:mm`).
- **`provide<Domain>Labels(...)`** - one call per domain you use in a non-English app, e.g.
  `provideTableLabels`, `providePaginationLabels`, `provideFormFieldLabels`,
  `provideSelectLabels`. Every label is partial; omitted keys keep their English default. The
  full list is in [Localization](/components/localization).
- **`provideIcons(...icons)`** - not app-wide setup: register icons on the component that
  renders them, so unused ones stay tree-shakeable ([Icon](/components/icon)).

## Locale (`@ethlete/core`)

- **`provideLocale('de')`** - the locale signal label tokens and date formatting react to.
  Defaults to `'en'`; skip it for an English-only app.

## Framework

- **`provideHttpClient()`** from `@angular/common/http` if you use `@ethlete/query`'s HTTP
  client ([Query](/query/)).
