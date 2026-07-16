# Icon

Inline-SVG icons rendered by the `[etIcon]` attribute directive — no icon font, no component wrapper. Icons are tree-shakeable constants registered per component (or once at the app root) via `provideIcons()`.

```ts
import { CHEVRON_ICON, ICON_IMPORTS, TIMES_ICON, provideIcons } from '@ethlete/components';

@Component({
  imports: [ICON_IMPORTS],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
  template: `
    <i class="size-6" etIcon="et-chevron"></i>
    <i class="size-6 rotate-90" etIcon="et-chevron"></i>
  `,
})
```

## Live demo

<StoryEmbed id="components-icon--default" height="320px" />

## How it works

- An icon is an `IconDefinition` — `{ name, variant?, data }` with an inline SVG string. The SDK ships a small built-in `et-*` set (`PLUS_ICON`, `CHEVRON_ICON`, `TIMES_ICON`, `ARROW_RIGHT_ICON`, `PENCIL_ICON`, …); your own icons are just more constants.
- `provideIcons(...icons)` registers them for the injector scope it's provided in. Registering the same name+variant twice throws in dev mode.
- `[etIcon]` renders the SVG via `innerHTML`, adds `aria-hidden="true"` and the classes `et-icon et-icon--<name>`.
- `variant` selects between registered variants of the same name. When unset, a variant-less registration wins, falling back to the `'solid'` variant. With a variant set, the host also gets an `et-icon--<name>--<variant>` class.

## Sizing & color

There is deliberately **no size or color input** — the SVGs use `width/height="100%"` and `currentColor`, so both come from CSS:

```html
<i class="size-6 text-red-500" etIcon="et-times"></i>
```

Dev mode validates every registered SVG for this: it must have `xmlns`, `width/height="100%"`, and no hardcoded colors (opt out per usage with `allowHardcodedColor` for intentionally multi-colored artwork).

## Typed icon names

The `etIcon` input is typed against the augmentable `EthleteIconNameRegistry` interface — augment it (or use the [generator below](#generating-icons)) to get string-literal completion for your app's icon set instead of plain `string`.

## Generating icons

Instead of hand-writing `IconDefinition`s, an Nx generator produces them from an installed SVG icon package:

```bash
yarn nx g @ethlete/components:icons
```

It reads a config file (default `src/icons.json`) listing the icons you use:

```json
{
  "variants": ["solid"],
  "icons": ["shield", "user", { "name": "star", "variants": ["solid", "light"] }]
}
```

and writes two files: the `IconDefinition` constants (default `src/generated/et-icons.ts`) — import and pass the ones each component needs to `provideIcons()` individually, so unused icons stay tree-shakeable — and a `.d.ts` that augments `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` so `etIcon` names and variants are string-literal typed. Each SVG is normalized on the way in — `width/height="100%"`, `fill="currentColor"`, license comments stripped — so the output passes the dev-mode validation above.

The `source` option defaults to `'auto'`, which detects Font Awesome (pro, then free) in `node_modules`; any package with a `svgs/<variant>/<name>.svg` layout works when named explicitly. Paths are configurable via `--configPath` / `--outputPath` / `--typesOutputPath`. Re-run the generator whenever the config changes — missing icons warn and are skipped rather than failing the run.

## Accessibility

Icons are always decorative: the directive sets `aria-hidden="true"` unconditionally. Meaning must come from the host — visible text next to the icon, or an `aria-label` on icon-only controls (see [icon buttons](/components/button)).

## Error codes

Icon problems throw [`ET18xx` errors](/components/error-codes#icon-et18xx) — missing registrations and unknown names always, SVG validation in dev mode.
