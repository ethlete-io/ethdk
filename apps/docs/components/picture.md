# Picture

A responsive image: `<figure><picture><source…><img></picture><figcaption></figure>` built from a list of
sources. Reach for it when one image needs several candidates - different resolutions, different formats, or a
different crop per viewport. For a single fixed image, a plain `<img>` is less machinery.

Import `PICTURE_IMPORTS`. `providePictureConfig({ baseUrl })` is optional.

```html
<et-picture
  [sources]="[
    { srcset: 'hero-wide.avif', media: '(min-width: 800px)' },
    { srcset: 'hero-tall.avif' },
  ]"
  [aspectRatio]="16 / 9"
  defaultSrc="hero.jpg"
  alt="The stadium at kickoff"
/>
```

## Live demo

<StoryEmbed id="components-media-picture--default" height="620px" />

## Three jobs, three mechanisms

They are easy to conflate, and picking the wrong one is why responsive images so often don't work:

| Goal                                                       | Mechanism                              | Where it goes                      |
| ---------------------------------------------------------- | -------------------------------------- | ---------------------------------- |
| **Resolution switching** - same picture, several sizes     | candidates in one `srcset` (+ `sizes`) | one source, comma-separated        |
| **Art direction** - a different crop for a narrow viewport | `media` on each source                 | several sources                    |
| **Format negotiation** - AVIF for those who can decode it  | `type` on each source                  | several sources, most modern first |

Sources are considered in order and the **first match wins**, so put the most specific `media` and the most
modern `type` first. A browser skips a `type` it can't decode without downloading anything.

`defaultSrc` is not optional in practice: a `<picture>` with no `<img>` renders nothing at all. It is what
loads when no source matched, so give it your most compatible format. A picture with `sources` but no
`defaultSrc` reports `state() === 'error'` (and warns in dev mode) instead of loading forever.

### `srcset` and `sizes` go together

With **width** descriptors (`hero-400.jpg 400w`) you must also pass `sizes`, or the browser has no way to know
how much of the viewport the image will occupy and will pick as if it were full-width. With **density**
descriptors (`hero@2x.jpg 2x`) you must not - the browser picks by device pixel ratio. The two forms can't be
mixed in one srcset.

`sizes` takes the attribute's own comma-separated string, or an array of its parts, which is easier to read:

```html
<et-picture [sizes]="['(min-width: 800px) 50vw', '100vw']" [sources]="sources" defaultSrc="a.jpg" alt="…" />
```

## Reserving space

An image with no reserved box shifts the page when it arrives, which is most of what Cumulative Layout Shift
measures. Two ways to avoid it:

- **`width` + `height`** - the intrinsic pixel dimensions. Use when you know them.
- **`aspectRatio`** - e.g. `16 / 9`. Use when CSS decides the rendered size, which for a responsive image is
  usually the case.

The `NoAspectRatio` story exists to show what you get without either: worth looking at once.

## Sizing: two modes, and they don't mix

An `et-picture` either lets the image size its own box, or is given a box the image must obey. Pick one per
usage site.

**The default: the image sizes its box.** `.et-picture-img` ships `max-inline-size: 100%` and
`block-size: auto`, so the image shrinks to fit its container and keeps its own ratio. To constrain the image
and let it size its own box (max-sizes, a single axis), style `.et-picture-img` directly:

```css
.hero .et-picture-img {
  max-block-size: 40svh;
  inline-size: auto;
}
```

**With `fit`: the host is the box.** Setting `fit` makes the figure, the picture and the image all fill the
host, so the host's own size - a class, `aspectRatio`, a grid or flex cell - decides the box, and `fit` decides
what the image does inside it. It maps straight onto CSS `object-fit`: `'contain' | 'cover' | 'fill' | 'none' |
'scale-down'`.

```html
<et-picture [fit]="'cover'" class="card-media" defaultSrc="hero.jpg" alt="…" />
```

```css
.card-media {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
}
```

::: warning `fit` needs a definite box in **both** axes
The wrappers fill the host with percentages, and a percentage `block-size` against an auto-height host resolves
to `auto`. With no definite height - a bare `<et-picture fit="cover">` in normal flow - the image degrades to
full-width, intrinsic-ratio height and `object-fit` has nothing left to do. Give the host a height, an
`aspect-ratio`, or a stretched grid/flex cell.

`object-fit: none` paints outside the box it was given; add `overflow: hidden` if you don't want that.
:::

<StoryEmbed id="components-media-picture--fit" height="640px" />

`aspectRatio` counts as a definite box here: with `fit` set, the image takes the host's inline size and its own
ratio decides the height, so `[fit]="'cover'" [aspectRatio]="1"` crops a 16:9 source into a square.

One caveat with a caption: `fit` gives the `<picture>` the host's whole height, so on a host with an explicit
height a `figcaption` is pushed below the host's box. Reach for the `aspectRatio` form above instead - the host
then grows to hold image _and_ caption.

## Loading priority

By default images are `loading="lazy"` and `fetchpriority="auto"`. Set `priority` on the **one** image that is
the largest thing in the initial viewport - a hero, a header - because it is usually the page's Largest
Contentful Paint, and lazy-loading the element that defines the metric delays it.

Never set it on images below the fold: everything marked high priority competes with everything else marked
high priority.

```html
<et-picture [sources]="heroSources" priority defaultSrc="hero.jpg" alt="…" />
```

## Placeholder and error slots

Two optional projected templates, for the states an image spends real time in:

```html
<et-picture [defaultSrc]="photo()?.url" [aspectRatio]="16 / 9" alt="…">
  <ng-template etPicturePlaceholder>
    <et-skeleton-item shape="rect" style="block-size: 100%; inline-size: 100%" />
  </ng-template>

  <ng-template etPictureError>
    <p>This image is unavailable.</p>
  </ng-template>
</et-picture>
```

The placeholder is **overlaid**, not swapped in - the `<img>` has to stay in the DOM to keep loading, and
replacing it would restart the request. Without an error slot, a failed image keeps the browser's own
broken-image rendering, which at least shows the alt text; with one, the slot covers it.

`state()` exposes the same thing as a signal (`'loading' | 'loaded' | 'error'`), and the host mirrors it as
`data-state` for styling. `imgLoad` and `imgError` fire as outputs.

## What the browser reports back

`imgLoad` carries the dimensions the browser decoded - `{ naturalWidth, naturalHeight }` - and the same numbers
are readable as signals, so a template can use them without keeping a copy:

- **`naturalSize()`** - `{ width, height } | null`. `null` while loading and after a failure, so `null` means
  "not measured", never "measured as zero".
- **`naturalAspectRatio()`** - `number | null`, width over height, i.e. the orientation CSS `aspect-ratio`
  takes. `1.777…` for a 16:9 image.

Both reset to `null` when `defaultSrc` or `sources` changes: a different image has a different intrinsic size,
and so does the same picture re-pointed at a new URL.

```html
<et-picture #picture [defaultSrc]="photo().url" alt="…" />

<p>{{ picture.naturalSize()?.width }} × {{ picture.naturalSize()?.height }}</p>
```

## Base URL

`providePictureConfig({ baseUrl })` prefixes every relative candidate, so sources can be authored as the paths
an API returns. Absolute URLs and `data:` URIs pass through untouched.

```ts
providers: [providePictureConfig({ baseUrl: 'https://cdn.example.com' })];
```

```html
<!-- becomes https://cdn.example.com/media/a.jpg 400w, https://cdn.example.com/media/b.jpg 800w -->
<et-picture [sources]="[{ srcset: 'media/a.jpg 400w, media/b.jpg 800w' }]" defaultSrc="media/a.jpg" alt="…" />
```

It is applied **per candidate**, which is the fix over `@ethlete/cdk`: that prefixed the srcset as a single
string, so only the first candidate of a relative multi-candidate srcset resolved.

## Options

| Input         | Type                              | Default | Purpose                                                            |
| ------------- | --------------------------------- | ------- | ------------------------------------------------------------------ |
| `sources`     | `(PictureSource \| string)[]`     | `[]`    | The `<source>` candidates. A string is shorthand for `{ srcset }`. |
| `defaultSrc`  | `PictureSource \| string \| null` | `null`  | The `<img>` behind them. Without it, nothing renders.              |
| `alt`         | `string` (**required**)           | -       | Alternative text. `''` declares the image decorative.              |
| `figcaption`  | `string \| null`                  | `null`  | A visible caption after the image.                                 |
| `priority`    | `boolean`                         | `false` | `loading="eager"` + `fetchpriority="high"`.                        |
| `width`       | `number \| null`                  | `null`  | Intrinsic width in px.                                             |
| `height`      | `number \| null`                  | `null`  | Intrinsic height in px.                                            |
| `aspectRatio` | `number \| string \| null`        | `null`  | CSS `aspect-ratio` on the `<img>`.                                 |
| `sizes`       | `string \| string[] \| null`      | `null`  | Fallback `sizes` for sources that don't set their own.             |
| `fit`         | see below                         | `null`  | `object-fit` inside a box the host defines. Needs a definite box.  |

`fit` takes `'contain' | 'cover' | 'fill' | 'none' | 'scale-down' | null`.

| Member                 | Type                                                      | Purpose                                        |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| `state()`              | `Signal<PictureState>`                                    | `'loading'`, `'loaded'` or `'error'`.          |
| `naturalSize()`        | `Signal<{ width: number; height: number } \| null>`       | Decoded intrinsic size; `null` until loaded.   |
| `naturalAspectRatio()` | `Signal<number \| null>`                                  | Intrinsic width ÷ height; `null` until loaded. |
| `imgLoad`              | `output<{ naturalWidth: number; naturalHeight: number }>` | The image finished loading.                    |
| `imgError`             | `output<void>`                                            | The image failed to load.                      |

Utilities are exported for consumers building their own markup: `extractFirstImageUrl`,
`normalizePictureSource`, `normalizePictureSizes`, `withPictureBaseUrl`.

## Accessibility

`alt` is a **required** input, deliberately. An image without alternative text is invisible to a screen reader,
and an optional input is one that gets forgotten - pass `''` for a decorative image, which is a positive
statement that it carries no information rather than an omission.

The wrapper is a real `<figure>`, and `figcaption` its `<figcaption>`, so a caption is programmatically
associated with the image rather than merely sitting near it. A loading placeholder is `aria-hidden` (it
represents nothing); an error slot is not, since its text is the only account of what happened.

## Theming

Picture paints nothing and declares no design tokens - the CSS is structural only: `display: block`, a
margin-free `<figure>`, `max-inline-size: 100%` on the image, and the positioning the slots need.

Every element it renders carries a stable class, and these four are **public API** - style them from your own
stylesheet and they will keep working:

| Class                    | Element                                      |
| ------------------------ | -------------------------------------------- |
| `.et-picture`            | the host                                     |
| `.et-picture-figure`     | the `<figure>` wrapper                       |
| `.et-picture-picture`    | the `<picture>`                              |
| `.et-picture-img`        | the `<img>` - the one you usually want       |
| `.et-picture-figcaption` | the `<figcaption>`, when `figcaption` is set |

Per state, use `.et-picture[data-state='error']`; with `fit`, the host also carries `data-fit`.

### Coming from `@ethlete/cdk`

The cdk predecessor took `imgClass`, `figureClass`, `pictureClass` and `figcaptionClass` inputs. They are gone
on purpose - passing a class per instance duplicates in every template what one stylesheet rule says once, and
it made the internal element structure part of the call signature. The two replacements are the two sizing modes
above:

- Filling a box you control → the **`fit`** input (this covers nearly every `imgClass="object-cover h-full"`).
- Anything else - max-sizes, one-axis constraints, borders, radius, captions → a rule on `.et-picture-img` (or
  the sibling classes) from your own stylesheet, scoped by a class of your own on the host.

::: tip Why not `NgOptimizedImage`?
Angular's directive is a good fit for a single `<img>` with a known loader, and it does things this component
doesn't (build-time loader integration, LCP warnings). It doesn't support multiple `<source>` elements, so art
direction and format negotiation are out of reach, and it has no opinion on `<figure>`/`<figcaption>`. Use
`NgOptimizedImage` for a plain image behind a CDN loader; use `et-picture` when you need sources.
:::
