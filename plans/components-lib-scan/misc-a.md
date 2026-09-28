# testing, pagination, breadcrumb, accordion, masonry, loader scan - open findings

Scan of `libs/components/src/lib/{testing,pagination,breadcrumb,accordion,masonry,loader}` from 2026-09-28. 0 High, 1 Medium, 22 Low, 1 Spec. Skipped: `testing/control-driver.ts`, `field-control-driver.ts`, `overlay-control-driver.ts`, `masonry/testing/masonry-driver.ts`, and most CSS (read only for colours, layers, motion).

## breadcrumb

- Low: `etBreadcrumbSeo` puts crumb names into a JSON-LD `<script>` through `applyStructuredDataBinding`, which writes `JSON.stringify(data)` with no `<` escape (`core/src/lib/seo/structured-data-binding.ts:58`, reached from `breadcrumb/seo/breadcrumb-seo.directive.ts:75`). Escape `<` as `<` the way `structured-data.component.ts:26` already does, and add a scenario with a hostile name. S Re-rated from High: no break-out, see `plans/core-lib-scan.md` (seo, app-update, notifications, unsaved-changes). Angular SSR's bundled domino rewrites `</script` inside script text to `&lt;/script` when it serialises, so a crumb name holding `</script>` arrives corrupted rather than escaping the script; a name holding `<!--<script` still puts the parser into the double-escaped state and swallows markup after it. Escaping `<` as `<` fixes both.
- Low: two `<et-breadcrumb-outlet>`s under one manager (a desktop and a mobile shell) each stamp every segment template, so each crumb template registers twice on its segment and both trails show every crumb twice (`breadcrumb-outlet.component.ts:38-40`, `headless/breadcrumb-segment.directive.ts:54-56`). Key crumbs per outlet, or dev-warn on a second outlet. M Re-rated from Medium: `provideBreadcrumbManager` JSDoc and the guide document a single outlet per manager, so the gap is the missing dev warning.
- Low: `BreadcrumbSegmentDirective.order` has no `numberAttribute` transform, but its JSDoc shows `order="0"` (`headless/breadcrumb-segment.directive.ts:42`). That static attribute fails strict template type-checks, and without them the sort does string subtraction. S
- Low: `BreadcrumbComponent` always imports `SKELETON_IMPORTS` for the opt-in `loading` state (`breadcrumb.component.ts:31`). Every breadcrumb bundles the skeleton. Move the placeholder behind a styles-only/opt-in piece if the skeleton is not trivial. S

## pagination

- Low: with `responsive` on, the window re-trims after each click and `@for … track $index` keeps focus on the same slot, which now shows a different page number (`pagination.component.html:28`). Track by `item.type + item.page` so focus follows the page. S
- Low: `PaginationSeoDirective` reads the raw `page` model, which is not clamped when `totalPages` shrinks (`seo/pagination-seo.directive.ts:45,54`). The canonical and `rel="prev"` then point at a page that does not exist. Clamp to `[1, totalPages]` as `range()` does. S
- Low: the jump-input border fallback is white at 15% (`pagination.component.css:148`), so it is invisible on a light surface without tokens. `page-size-select.component.css:53` uses the neutral `rgb(128 128 128 / 0.3)`; use the same. S
- Low: comments outside the allowlist: `pagination.component.ts:116,122,228-229,295-296`, the template comments at `pagination.component.html:3,11-12` and `page-size-select.component.ts:37-38,47-49`, the design rationale in JSDoc at `page-size-select.component.ts:11-18`, `seo/pagination-seo.directive.ts:11-16` and `pagination.imports.ts:8-11`. S

## accordion

- Low: arrow-key navigation also fires on `Ctrl`/`Alt`/`Meta` combinations (`headless/accordion-group.directive.ts:186-200`), and that takes `Ctrl+Home`/`Ctrl+End` away from the page. Return `null` when a modifier is held. S
- Low: comments outside the allowlist: `headless/accordion.directive.ts:101-102,115-117`, `accordion.component.html:22-23`, and most of the rationale blocks in `accordion.component.css` (lines 8, 28, 43, 59, 72, 94, 97, 119, 148, 160, 182, 197, 204). S

## masonry

- Low: an `import` comes after three helper declarations (`headless/masonry.directive.ts:38`). Move the helpers below the imports. S
- Low: the item always sets `role="listitem"` and the host always sets `role="list"` (`headless/masonry-item.directive.ts:35`, `headless/masonry.directive.ts:68`), but the JSDoc says `<ul>`/`<li>` needs no ARIA roles (`headless/masonry-item.directive.ts:24-25`). A masonry of `<article>` cards gets a list role that it cannot turn off. Pick one: drop the forced roles or fix the doc. S
- Low: `useMasonryResizeSettled` sets a signal from `tap` + `.subscribe()` (`headless/internals/masonry-resize-settled.ts:26-35`), and the first non-zero width still counts as a resize, although the comment at `:28` says it does not. Use `toSignal` with a `switchMap` to `timer`, and fix the comment or the filter. S
- Low: `childMutations` observes `subtree: true` (`headless/masonry.directive.ts:106`), so every node insertion inside any card re-runs `sortByDomOrder` over all items. For a long live feed, observe `childList` on the host only; item re-orders happen at that level. S
- Low: migration narration about cdk in public JSDoc (`headless/masonry.directive.ts:51-53,152,190-193`, `headless/masonry-item.directive.ts:21-22`, `headless/internals/masonry-layout.ts:14-15,58-60`), plus long rationale comments (`headless/masonry.directive.ts:100-104,122-126,160-162,211-218,231-234,254-256`). S

## loader

- Medium: `et-spinner` and `et-progress-bar` have `role="progressbar"` and no accessible name by default (`spinner/spinner.component.ts:105`, `progress-bar/progress-bar.component.ts:23`). Axe `aria-progressbar-name` fails for every consumer that does not add an `aria-label`. Default the name to `LOADER_LABELS.loading` as the brand loader does, with an input to override it. S Verified.
- Low: `circleStrokeWidth` is a copy of `normalizedStrokeWidth`, and all geometry computeds are `public` (`spinner/spinner.component.ts:128-148`). Make them `protected` and delete the duplicate. S
- Low: a `NaN` `value` from `numberAttribute` goes through `Math.min`/`Math.max` as `NaN` and renders `aria-valuenow="NaN"` (`spinner/spinner.component.ts:142`, `progress-bar/progress-bar.component.ts:33`). Fall back to 0. S
- Low: `BrandLoaderComponent` uses a module-level `nextId` counter (`brand-loader/brand-loader.component.ts:10,47-54`) instead of `createComponentId`. The counter is shared by all SSR requests of a process. S
- Low: the brand accent is a literal `#00ffa1` behind a component-only custom property, not a theme token (`brand-loader/brand-loader.component.css:81`). Resolve it from `--et-theme-color-*` with the literal as the last fallback. S
- Low: `SpinnerComponent`, `ProgressBarComponent` and `BrandLoaderComponent` and their inputs have no JSDoc, though they are public exports (`spinner/spinner.component.ts:15-118`, `progress-bar/progress-bar.component.ts:3-31`). S

## testing

- Low: `once` and `installProperty` are copied between `fake-layout.ts:45-78` and `destroyed-mid-gesture.ts:27-47`. Move them to one internal file. S
- Low: `recordFrames` catches every error thrown in a frame, but only checks errors after the destroy (`destroyed-mid-gesture.ts:63-67,212`). An error thrown during the gesture itself is swallowed, and the assertion passes. Rethrow or assert on `errorsBefore === 0`. S

## Spec gaps

- Spec: no breadcrumb SEO spec with a crumb name that contains `</script>` or `<`. S
