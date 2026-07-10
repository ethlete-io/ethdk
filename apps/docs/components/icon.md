# Icon

Inline-SVG icons rendered by the `[etIcon]` attribute directive — no icon font, no component wrapper. Icons are tree-shakeable constants registered per component (or once at the app root) via `provideIcons()`.

```ts
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
- `variant` selects between registered variants of the same name (defaults to `'solid'`).

## Sizing & color

There is deliberately **no size or color input** — the SVGs use `width/height="100%"` and `currentColor`, so both come from CSS:

```html
<i class="size-6 text-red-500" etIcon="et-times"></i>
```

Dev mode validates every registered SVG for this: it must have `xmlns`, `width/height="100%"`, and no hardcoded colors (opt out per usage with `allowHardcodedColor` for intentionally multi-colored artwork).

## Typed icon names

The `etIcon` input is typed against the augmentable `EthleteIconNameRegistry` interface — augment it (or use the generator) to get string-literal completion for your app's icon set instead of plain `string`.
