# testing, pagination, breadcrumb, accordion, masonry, loader scan - open findings

Scan of `libs/components/src/lib/{testing,pagination,breadcrumb,accordion,masonry,loader}` from 2026-09-28. 0 High, 1 Medium, 3 Low, 1 Spec. Skipped: `testing/control-driver.ts`, `field-control-driver.ts`, `overlay-control-driver.ts`, `masonry/testing/masonry-driver.ts`, and most CSS (read only for colours, layers, motion).

## breadcrumb

- Low: `etBreadcrumbSeo` puts crumb names into a JSON-LD `<script>` through `applyStructuredDataBinding`, which writes `JSON.stringify(data)` with no `<` escape (`core/src/lib/seo/structured-data-binding.ts:58`, reached from `breadcrumb/seo/breadcrumb-seo.directive.ts:75`). Escape `<` as `<` the way `structured-data.component.ts:26` already does, and add a scenario with a hostile name. S Re-rated from High: no break-out, see `plans/core-lib-scan.md` (seo, app-update, notifications, unsaved-changes). Angular SSR's bundled domino rewrites `</script` inside script text to `&lt;/script` when it serialises, so a crumb name holding `</script>` arrives corrupted rather than escaping the script; a name holding `<!--<script` still puts the parser into the double-escaped state and swallows markup after it. Escaping `<` as `<` fixes both. Left for the core Low in `plans/core-lib-scan.md` (seo), which owns the fix; add the breadcrumb scenario after it lands.

## masonry

- Low: the item always sets `role="listitem"` and the host always sets `role="list"` (`headless/masonry-item.directive.ts:35`, `headless/masonry.directive.ts:68`), but the JSDoc says `<ul>`/`<li>` needs no ARIA roles (`headless/masonry-item.directive.ts:24-25`). A masonry of `<article>` cards gets a list role that it cannot turn off. Pick one: drop the forced roles or fix the doc. S

## loader

- Medium: `et-spinner` and `et-progress-bar` have `role="progressbar"` and no accessible name by default (`spinner/spinner.component.ts:105`, `progress-bar/progress-bar.component.ts:23`). Axe `aria-progressbar-name` fails for every consumer that does not add an `aria-label`. Default the name to `LOADER_LABELS.loading` as the brand loader does, with an input to override it. S Verified.
- Low: the brand accent is a literal `#00ffa1` behind a component-only custom property, not a theme token (`brand-loader/brand-loader.component.css:81`). Resolve it from `--et-theme-color-*` with the literal as the last fallback. S

## Spec gaps

- Spec: no breadcrumb SEO spec with a crumb name that contains `</script>` or `<`. S
