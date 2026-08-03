# Picture

`et-picture` renders a responsive `<picture>` element - a list of `<source>` entries plus a fallback `<img>`, optionally wrapped in a `<figure>` with caption. It's also the rendering target of the [`@ethlete/contentful`](/contentful/#images) image component.

::: warning Superseded by @ethlete/components
New code should use the [components picture](/components/picture) (`PICTURE_IMPORTS`). `sources`,
`defaultSrc`, `figcaption`, `width`, `height` and `sizes` are unchanged; `hasPriority` becomes `priority`,
`alt` is required (pass `''` to declare the image decorative), `provideImageConfig` becomes
`providePictureConfig` (and prefixes each srcset candidate rather than the whole string), and it adds
`aspectRatio` plus placeholder and error slots. The `imgClass` / `pictureClass` / `figureClass` /
`figcaptionClass` passthroughs are deliberately not carried over: fill a box you control with the new `fit`
input, and style anything else through the stable `.et-picture-img` &co. classes from your own stylesheet.
This page documents the CDK version, which still receives bug fixes.
:::

```html
<et-picture
  [sources]="[
    { srcset: 'img-800.avif', media: '(min-width: 800px)', type: 'image/avif' },
    { srcset: 'img.jpg 1x, img@2x.jpg 2x' },
  ]"
  [width]="600"
  [height]="300"
  defaultSrc="img.jpg"
  alt="A description"
/>
```

```ts
import { PictureImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-picture--default" height="380px" />

## Options

| Input                                                        | Default | Purpose                                                                                     |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------- |
| `sources`                                                    | `[]`    | `<source>` entries - `{ srcset, type?, sizes?, media? }` or plain srcset strings.           |
| `defaultSrc`                                                 | `null`  | The fallback `<img>` source; its first URL becomes `src`, the full srcset becomes `srcset`. |
| `alt`                                                        | `null`  | Alt text.                                                                                   |
| `figcaption`                                                 | `null`  | Renders a `<figcaption>` when set.                                                          |
| `hasPriority`                                                | `false` | `true` → `loading="eager"` + `fetchpriority="high"`; `false` → `loading="lazy"`.            |
| `width` / `height`                                           | `null`  | Explicit `<img>` dimensions (avoids layout shift).                                          |
| `sizes`                                                      | `null`  | Fallback `sizes` attribute (string or array); per-source `sizes` wins.                      |
| `imgClass`, `pictureClass`, `figureClass`, `figcaptionClass` | `null`  | Class passthroughs to each element.                                                         |

Outputs `imgLoaded` / `imgError` mirror the image's `load` / `error` events.

## Behavior

Srcsets support width descriptors (`800w`, pair them with `sizes`) or density descriptors (`2x`) - not both in one srcset. When a source has no explicit `type`, the MIME type is inferred from the URL. With `provideImageConfig({ baseUrl: '…' })`, relative srcsets are prefixed with your CDN base URL (absolute and `data:` URLs are left alone).

## Styling

The component ships no CSS. The rendered structure is `figure.et-picture-figure > picture.et-picture-picture > img.et-picture-img` (+ `figcaption.et-picture-figcaption`), and every element also accepts consumer classes via the `*Class` inputs.
