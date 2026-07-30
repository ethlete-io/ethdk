# 10 — Quick wins

Independent, small items. Each is a self-contained PR (component change +
story + docs + changeset). Ordered by value.

## 1. Pagination page-size selector

`pagination.component.ts:96-100` — the component's own doc comment describes
"a Material-style controls row where the paginator sits inline with a
page-size select" but ships no such control; `pageSize` is only used for the
range readout. Add `et-page-size-select`: a small select (compose the
existing `et-select` or a minimal native select — decide by bundle weight;
the paginator shouldn't drag the full select panel in, so lean native +
styled) with `sizes: number[]` input and a `pageSize` model; label via the
pagination labels token. Standalone component that pairs with the paginator
in a row — don't bolt it into the paginator itself. When page size changes,
consumers typically reset to page 1 — emit and document, don't hardcode.

## 2. Breadcrumb schema.org JSON-LD

SEO win, near-zero cost: core already has `structured-data-binding.ts` and
pagination established the opt-in SEO-directive pattern
(`pagination/seo/pagination-seo.directive.ts`). Add `etBreadcrumbSeo`
directive emitting a `BreadcrumbList` JSON-LD script from the registered
crumbs (label + resolved URL; skip the loading-placeholder crumbs). Same
opt-in import structure as pagination's.

## 3. Accordion "keep one open" mode

`accordion-group.directive.ts:34` — `autoCloseOthers` keeps _at most_ one
panel open; there's no way to force _at least_ one (Radix
`collapsible={false}`). Add `preventCloseLast` (boolean, default false):
collapsing the only open panel is a no-op. Header button still exposes
correct `aria-expanded`; no `aria-disabled` (the control isn't disabled, the
action is conditionally inert — document the choice).

## 4. Styled checkbox-group select-all

Tri-state logic exists headless-only
(`selection-list/headless/selection-list-control.directive.ts`); the story
hand-rolls markup/CSS to demo it. Ship `et-checkbox-group-select-all`: a
prebuilt row composing the directive + `et-checkbox` with mixed-state
rendering, styled to sit above `et-checkbox-group`. Label input (default via
labels token). Replace the story's hand-rolled version with it.

## 5. Selection-list orientation

No `orientation` input; CSS hardcodes `flex-direction: column`
(`checkbox-group.component.css:40`, `radio-group.component.css:40`). Add
`orientation: 'vertical' | 'horizontal'` (default vertical) on the group
components → `data-orientation` attribute → row + wrap layout in CSS
(`:where()` modifier pattern). Radio-group keyboard: ArrowLeft/Right should
move selection in horizontal mode the way ArrowUp/Down do vertically (check
what the headless directive binds today; ARIA radio pattern expects all four
arrows to work regardless — verify, then just ensure focus order is sane).
Segmented-button-group is already horizontal — untouched.

## 6. Meaningful (non-decorative) icon opt-in

`icon/headless/icon.directive.ts:28` statically hardcodes
`aria-hidden="true"`; a standalone status glyph (e.g. alone in a table cell)
has no accessible path. Add an optional `label` input: when set, render
`role="img"` + `aria-label` instead of `aria-hidden`. Update `icon.md`'s
guidance ("meaning must come from the host") to mention the opt-in.

## 7. Menu wrap opt-out

`menu.directive.ts:567-568` hardcodes modulo wrap-around for arrow
navigation. Add `loop` input (default `true`, current behavior). Smallest
item here — bundle with any other menu touch.

## Notes

- Items 1, 4 and any new labels: route strings through the domain label
  tokens consistent with `03-i18n-consolidation.md`.
- Every item: lint `--fix`, prettier, story, docs page update, changeset
  (`@ethlete/components`, patch/minor as appropriate).
