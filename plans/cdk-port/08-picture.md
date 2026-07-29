# 08 — Picture

**Status: DONE (2026-07-30).** Size: S. Research done 2026-07-23 against
`libs/cdk/src/lib/components/picture/` (~390 lines). Shipped net-new in
`libs/components/src/lib/picture/`. cdk picture untouched.

## What cdk ships today

`et-picture`: renders `<figure><picture><source*><img></picture><figcaption?>`
from a `sources: (PictureSource | string)[]` input (mime type inferred via
core's `inferMimeType`), `defaultSrc` fallback img (first URL extracted from
srcset, handles data URIs and descriptors — has specs), `hasPriority` toggling
`loading`/`fetchpriority`, `width`/`height` passthrough for layout
reservation, per-part `NgClass` inputs, `imgLoaded`/`imgError` outputs,
`provideImageConfig({ baseUrl })` prefix for relative srcsets. Signal inputs
already. **No CSS at all.** No blur-up placeholder, no aspect-ratio helper, no
CDN resizing syntax (baseUrl is a plain prefix).

## What shipped

`libs/components/src/lib/picture/` — a single Tier 3 component plus two slot
directives and the URL utilities. No headless tier: the component has no
behavior to separate from its presentation (it renders markup and reports two
DOM events), so a headless directive would hold nothing.

| File                            | Role                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `picture.component.ts/html/css` | The component; structural CSS only, in `@layer components`      |
| `picture-slots.directive.ts`    | `etPicturePlaceholder` / `etPictureError` template slots        |
| `picture.utils.ts` (+ spec)     | srcset extraction, source/sizes normalization, base-URL joining |
| `picture-config.ts`             | `providePictureConfig` / `injectPictureConfig`                  |
| `picture.types.ts`              | `PictureSource`, `PictureConfig`, `PictureState`                |

Plus `apps/docs/components/picture.md` (+ sidebar, overview), 2 stories, a
`minor` changeset. 15 unit tests.

## Carried over as planned

- DOM shape kept (`figure` > `picture` > `source*` + `img`, optional
  `figcaption`), `sources`/`defaultSrc` normalization, mime-type inference,
  `provideImageConfig` → `providePictureConfig`, load/error outputs.
- **`NgClass` inputs dropped** — global `et-` classes + `@layer components` mean
  a consumer targets `.et-picture-img` directly.
- **`aspectRatio` added**, and the utils' specs ported and extended.
- **Placeholder/error slots added** as `ng-template` directives, plus a
  `state()` signal (`'loading' | 'loaded' | 'error'`) mirrored on the host as
  `data-state`.
- Utils stayed in the component's folder rather than moving to `core`: they are
  `PictureSource`-shaped, i.e. this domain's types, and nothing else wants them.
- `NgOptimizedImage` interop: documented as a tip on the docs page (it supports
  no multiple `<source>`, so art direction and format negotiation are out of its
  reach; use it for a plain CDN-loaded `<img>`).

## Deviations (deliberate)

- **`alt` is a required input.** cdk had it nullable. An image with no
  alternative text is invisible to a screen reader, and an optional input is one
  that gets forgotten; `alt=""` remains available and now reads as a deliberate
  "this is decorative" rather than an omission.
- **`hasPriority` → `priority`** — matches `NgOptimizedImage` and the attribute
  it sets.
- **`imgLoaded` → `imgLoad`** — the styleguide's present-tense output rule, and
  the name of the DOM event it forwards.
- **Two cdk base-URL bugs fixed** (both covered by new tests):
  - the prefix was applied to the srcset **as one string**, so
    `'a.jpg 1x, b.jpg 2x'` left the second candidate unresolved. Now applied per
    candidate, descriptors preserved.
  - a base URL ending in `/` and a path starting with `/` produced `host//path`.
- The mime-inference failure logs a **dev-mode warning** rather than an
  unconditional `console.error` — the browser copes without `type`, so it is not
  an error, and it should not ship to production logs.

## Verification

- 15 unit tests over the URL utilities (including the two fixed bugs).
- Driven headlessly in Storybook: art direction genuinely swaps the source
  (`naturalWidth` 800×450 at a 900px viewport, 450×600 at 600px), `priority`
  emits `loading="eager"`/`fetchpriority="high"`, the `<figure>` has no UA
  margin, `aspect-ratio` lands on the img, the placeholder shows while the URL
  is absent and clears once loaded (and returns when the URL is cleared —
  covered by the `linkedSignal` reset), and the error slot renders with the
  broken img hidden behind it.

## Follow-up (not blocking)

- No CDN resizing syntax (`baseUrl` is still a plain prefix). If an app wants
  width-parameterized URLs, a `loader`-style hook on `PictureConfig` is the
  natural next step — deliberately not guessed at here.
