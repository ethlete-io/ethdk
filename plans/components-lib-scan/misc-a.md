# testing, pagination, breadcrumb, accordion, masonry, loader scan - open findings

Scan of `libs/components/src/lib/{testing,pagination,breadcrumb,accordion,masonry,loader}` from 2026-09-28. 0 High, 1 Medium, 2 Low, 1 Spec. Skipped: `testing/control-driver.ts`, `field-control-driver.ts`, `overlay-control-driver.ts`, `masonry/testing/masonry-driver.ts`, and most CSS (read only for colours, layers, motion).

## masonry

- Low: the item always sets `role="listitem"` and the host always sets `role="list"` (`headless/masonry-item.directive.ts:35`, `headless/masonry.directive.ts:68`), but the JSDoc says `<ul>`/`<li>` needs no ARIA roles (`headless/masonry-item.directive.ts:24-25`). A masonry of `<article>` cards gets a list role that it cannot turn off. Pick one: drop the forced roles or fix the doc. S

## loader

- Medium: `et-spinner` and `et-progress-bar` have `role="progressbar"` and no accessible name by default (`loader/spinner/spinner.component.ts:113`, `loader/progress-bar/progress-bar.component.ts:31`; both JSDocs now tell the consumer to add an `aria-label`). Axe `aria-progressbar-name` fails for every consumer that does not add an `aria-label`. Default the name to `LOADER_LABELS.loading` as the brand loader does, with an input to override it. S Verified.
- Low: the brand accent is a literal `#00ffa1` behind a component-only custom property, not a theme token (`loader/brand-loader/brand-loader.component.css:81`). Resolve it from `--et-theme-color-*` with the literal as the last fallback. S

## Spec gaps

- Spec: no breadcrumb SEO spec with a crumb name that contains `</script>` or `<`. The core binding now escapes `<` and has its own spec, so this only pins the breadcrumb path. S
