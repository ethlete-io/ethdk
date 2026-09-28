# contentful + types scan - open findings

Scan of `libs/contentful/src/` and `libs/types/src/` from 2026-09-28. 4 Medium, 9 Low, 2 Spec (verified 2026-09-28: 5 confirmed, 1 re-rated; the High is fixed). Skipped: stories, the 97 generated view files in `libs/types` beyond an export and `any` check.

## contentful: rich-text renderer

- Medium: the diff preserves a text span, element or component when its position and nesting match, but does not compare its old parent id with the new one (`rich-text-renderer.component.ts:407-439`). Old `p["Hello"], p[Entry]` to new `p[Entry], p["Hello"]` keeps the old DOM unchanged, because `t0`, `e-o0` and `e-o1` all look preserved. Store the parent id on each command and require it to match. S Verified: `domPosition` resets per parent and element ids are sequential, so the swapped nodes match on id, nesting and position.
- Medium: the embedded-asset branch reads `asset.fields.file.contentType` before the missing-file check (`rich-text-renderer.component.ts:526-529`). The Delivery API omits `fields.file` when no file exists for the locale, so the case the warning describes throws a `TypeError`; the spec fixture uses `file: { url: null }` and misses it. The same unguarded `fields.file` read is in `file/contentful-file.component.ts:47`, `video/contentful-video.component.ts:40`, `audio/contentful-audio.component.ts:43` and `image/contentful-image.component.utils.ts:20,85,91`. Make `file` optional in `ContentfulRestAsset` (`types/contentful.types.ts:153`) and guard with `?.`. S Verified.
- Low: unknown node types fall through to `<div>` without a dev-mode warning (`rich-text-renderer.util.ts:64`). `resource-hyperlink` and `embedded-resource-inline` then render a block `<div>` inside a `<p>`, and `embedded-resource-block` disappears without a trace. Warn in dev mode and map unknown inlines to `span`. S
- Low: a hyperlink merges the marks of all its text children and applies them to the whole link text (`rich-text-renderer.component.ts:601-606`), so "see **here**" renders fully bold. S
- Low: `parentIdOf`, `findParent` and `findFollowingElement` scan all commands or the whole cache per command (`rich-text-renderer.component.ts:367,1006,1038`). This is O(n^2) for a long article. Keep a parent id and a per-parent child list on each command. M
- Low: unreachable cases in `translateContentfulNodeTypeToHtmlTag` (`rich-text-renderer.util.ts:44-62`; the renderer handles embeds, hyperlinks, `text` and `document` before it gets there), with the comment `// Will be ignored by the renderer`. Typo "to low" in the dev warning at `rich-text-renderer.component.ts:232`. S

## contentful: link, config, bundle

- Medium: the current page host also matches its subdomains (`link/contentful-link.component.ts:71-73`). On `example.com`, a link to `https://shop.example.com/cart` becomes an in-app router navigation to `/cart`. A different port on the same host has the same result. The docs promise subdomain matching only for configured `internalHosts`. Match `location.hostname` exactly and compare `port`. S Verified: `matchesHostname` applies the `.endsWith` subdomain rule to `document.location.hostname` too, and ignores the port.
- Low: `createContentfulConfig` merges shallowly (`utils/contentful-config.ts:26-44`). `provideContentfulConfig({ components: { image: MyImage } })` type-checks but drops the default link, file, video and audio components, so links render as plain anchors and other assets are skipped. Merge `components` and `imageOptions` one level deep. S Re-rated from Medium: `apps/docs/contentful/index.md` documents the shallow merge in a warning box, so this is an API improvement, not a bug.
- Medium: `provideContentfulConfig` always bundles all five default components (`utils/contentful-config.ts:2-6,29-35`), including `PictureComponent` and `RouterLink`, even when the app replaces every one of them. Not measured; no golden covers `provideContentfulConfig`. Resolve the defaults lazily, or ship them as an opt-in `withContentfulDefaultComponents()`. M Verified by reading: `createContentfulConfig` references all five statically. The size is still not measured.
- Low: `usesRouterLink` sends query-only and dot-relative hrefs (`?page=2`, `./x`) through `router.parseUrl` (`link/contentful-link.component.ts:76,92`), which resolves them from the root and drops the current path. S
- Low: the fallback `<a>` (no link component configured) sets no `target` or `rel` for external links (`rich-text-renderer.component.ts:616-619`). The link component does set them. S
- Low: the file link and the audio figcaption render `title` only (`file/contentful-file.component.ts:13`, `audio/contentful-audio.component.ts:12`). An asset without a title gets a link that has no accessible name except the size. Fall back to `fileName`. S

## types

- Low: `LineupPlayerV2View` is exported from `api/Lineup/index.ts:1` but missing from the root `api/index.ts`, so consumers cannot import it from `@ethlete/types`. Fix it in the generator; the file is generated. S

## Spec gaps

- Spec: no diff test mixes text and components across parents (the swap case above), and none covers an asset without `fields.file`. S
- Spec: the link spec has no case for the current host's subdomains, a different port, or query-only and relative hrefs. S
