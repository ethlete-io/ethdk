# 08 — Picture

**Status: planned, not started.** Size: S. Research done 2026-07-23 against
`libs/cdk/src/lib/components/picture/` (~390 lines). Net-new in
`libs/components` (no image component exists there).

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

## Rewrite decisions

- **Straightforward port with cleanups** — the feature is sound and small:
  keep the DOM shape, `sources`/`defaultSrc` normalization + utils (port the
  specs too), `hasPriority`, `provideImageConfig`, load/error outputs (expose
  as signals too, e.g. `state: 'loading'|'loaded'|'error'`).
- **Drop the four `NgClass` inputs** — that's a cdk-era styling escape hatch;
  the components lib convention is global `et-` classes + `@layer components`,
  so consumers can target `.et-picture img` etc. directly. Keep only if a
  concrete consumer need surfaces.
- **Add** (cheap, high-value):
  - `aspectRatio` input → CSS `aspect-ratio` on the img (prevents CLS even
    when only one dimension is known).
  - Optional error/placeholder slot (projected template shown on `imgError` /
    while loading) — cdk consumers had to build this around the outputs.
- Evaluate whether part of the URL/srcset utility layer belongs in `core`
  (framework-agnostic helpers) — decide during implementation; default is
  keeping it all in the component's folder.
- Consider `NgOptimizedImage` interop: document why we don't use it (multi
  `<source>`/art-direction support, figure/caption, baseUrl config) or adopt
  pieces if trivial. A one-paragraph docs note is enough.
- Minimal structural CSS (`display:block`, img `max-width:100%`), wrapped in
  `@layer components`; no colors involved.

## Deliverables

Component + utils (+ specs ported), stories (art direction via media sources,
priority vs lazy, error placeholder, aspect ratio), docs page
(`apps/docs/components/picture.md`), changeset. cdk picture stays untouched.
