# Icons

Inline-SVG icons rendered by the `[etIcon]` attribute directive - no icon font, no HTTP request, no component wrapper. Icons are plain tree-shakeable constants that you register with `provideIcons()` on whatever injector should see them.

::: warning Superseded by @ethlete/components
New code should use the [components icon](/components/icon) (`ICON_IMPORTS`). `provideIcons`,
`ICONS_TOKEN`, `IconDefinition`, `CHEVRON_ICON` and `TIMES_ICON` all keep their names and signatures, and
`[etIcon]` gains typed icon names, a `variant` system, a `label` input for meaningful icons and
`provideIconOverrides()` for swapping the built-in set app-wide. The built-in set is also much larger there.
This page documents the CDK version, which still receives bug fixes.
:::

```ts
import { CHEVRON_ICON, IconImports, TIMES_ICON, provideIcons } from '@ethlete/cdk';

@Component({
  imports: [IconImports],
  providers: [provideIcons(CHEVRON_ICON, TIMES_ICON)],
  template: `
    <i etIcon="et-chevron"></i>
    <i etIcon="et-times"></i>
  `,
})
export class MyComponent {}
```

## Registering icons

An icon is an `IconDefinition` - `{ name, data }`, where `data` is an inline SVG string:

```ts
import { IconDefinition } from '@ethlete/cdk';

export const STAR_ICON: IconDefinition = {
  name: 'my-star',
  data: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <path fill="currentColor" d="…" />
  </svg>`,
};
```

`provideIcons(...icons)` builds the lookup map for the injector it is provided on. Put it on a component's `providers` and only that component subtree sees those icons; put it on the app's providers and every component does. Registering the same `name` twice in one call throws.

Because the resolution is per-injector, a component that provides its own icons is self-contained - which is how the CDK's own components work (the scrollable provides `CHEVRON_ICON` for its buttons). A component provided with no icons at all throws on construction.

The SDK ships two icons: `CHEVRON_ICON` (`et-chevron`) and `TIMES_ICON` (`et-times`).

## Sizing & color

There is deliberately no size or color input. The SVGs use `width="100%" height="100%"` and `fill="currentColor"`, so both come from the CSS around them:

```html
<i style="width: 24px; height: 24px; color: red" etIcon="et-times"></i>
```

Dev mode validates every SVG it renders and throws when the contract is broken: the markup must contain `<svg>`, carry the `xmlns` attribute, declare `width="100%"` and `height="100%"`, and use `currentColor` for `fill`, `stroke`, `stop-color` and `stop-opacity`. Set `allowHardcodedColor` on the usage to keep a deliberately multi-colored icon:

```html
<i allowHardcodedColor etIcon="my-brand-logo"></i>
```

Rendering an unregistered name throws with the list of names that _are_ available in that scope.

## Accessibility

The directive sets `aria-hidden="true"` unconditionally - icons here are decoration, and the host element is inlined into the SVG's parent. Give the meaning to the surrounding control: label the button, not the glyph.

```html
<button aria-label="Close" type="button">
  <i etIcon="et-times"></i>
</button>
```

## Styling

The host gets `et-icon` plus `et-icon--<name>`, so `et-icon--et-chevron` targets every chevron. The directive also sets `display: flex` with centered alignment inline on the host, so the SVG fills whatever box you give it.
