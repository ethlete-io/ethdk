# 03 — Skeleton

**Status: planned, not started.** Size: S. Research done 2026-07-23 against
`libs/cdk/src/lib/components/skeleton/` (~280 lines incl. stories/docs).
Net-new in `libs/components` — no skeleton concept exists there. Natural home:
next to `libs/components/src/lib/loader/` (spinner/progress-bar/brand-loader
are its siblings; review their CSS for established token/animation patterns).

## What cdk ships today

Deliberately tiny: `et-skeleton` container (visually-hidden `loadingAllyText`,
default `"Loading..."`; `animated` boolean toggling a host class) +
`et-skeleton-item` (empty, `aria-hidden="true"`, zero inputs). Shimmer is a
`::before` overlay animated `translateX(-100%) → translateX(100%)` via CSS
keyframes, gated on the container's `--animated` class and wrapped in
`@media (prefers-reduced-motion: no-preference)` (omitted entirely under
reduced motion, independent of the `animated` input). All shape/size/color
comes from consumer CSS — no shape API at all.

## Rewrite decisions

- **Keep the CSS-driven philosophy** (items sized by consumer CSS) — it's the
  right "light by default" core. Add **optional shape conveniences** on the
  item as attribute-style inputs mapped to `data-*` + CSS: `shape="circle" |
"rect" | "text"` (text = 1em-ish bar), so common cases don't need custom CSS.
  Consider an `et-skeleton-text lines="3"` helper that renders n text bars with
  a shorter last line — cheap, high-value; keep it a separate component so the
  base stays dumb.
- **Theming is the actual work.** cdk hardcodes the shimmer gradient grays
  (`rgba(190,190,190,0)` / `rgba(129,129,129,.5)`) and ships no bone color
  (stories hardcode `#343434`/`#555555`). The rewrite must derive both the
  bone background and the shimmer highlight from **surface theming tokens**
  (`--et-surface-*`) per the `theming` skill, so skeletons look right on every
  registered surface/elevation — read the skill before writing any CSS. Expose
  `--et-skeleton-*` custom properties (gradient/duration/easing, like cdk) as
  the override surface, with themed defaults.
- **CSS conventions**: `@layer components`, `:where()` for config modifiers,
  ViewEncapsulation.None global classes — unlike cdk's unlayered scss. cdk's
  `--ease-3` token and `cdk-visually-hidden` class don't exist in components;
  use whatever easing/visually-hidden equivalents the components lib already
  has (check `loader`'s CSS and core utilities; add a local one if none).
- **Keep**: reduced-motion media-query gating (omit, don't pause), `animated`
  input as independent off-switch, `aria-hidden` items + visually-hidden
  loading text on the container, `cursor: progress`.
- **Consumers**: `01-table.md` renders skeleton rows while loading — keep the
  item API friendly to programmatic composition (a table cell containing a
  `shape="text"` item should be one element, no wrapper CSS required).

## Deliverables

Components (container, item, optional text helper), stories (card example like
cdk's avatar+bars, reduced-motion note, per-surface theming demo), docs page
(`apps/docs/components/skeleton.md`), changeset (`@ethlete/components` minor).
cdk skeleton stays untouched (maintenance).
