# Contentful lib scan — noteworthy findings

Scan date: 2026-08-19. Scope: all of `libs/contentful` — about 2.7k lines of non-spec source,
plus the v5 migration generator, the stories, and the packaging files. Three parallel review
agents read the source. Each agent verified its claims against the code; the rich-text and
generator agents also verified their top claims at runtime.

Severity counts: **7 high**, **17 medium**, **24 low**.

## Summary of the worst problems

1. The rich-text diff resets `domPosition` to 0 for every nested child. A re-created node inside a preserved parent is appended to the end, so a text edit reorders siblings. (rich-text)
2. The same defect moves a preserved inline embedded component past re-created text. The covering spec asserts only `toContain`, so it passes on corrupted output. (rich-text)
3. A whitespace-only text node loses its content on render. Contentful emits this shape for a space between two marked runs, so `bold italic` renders as `bolditalic`. (rich-text)
4. A `mailto:`, `tel:`, or fragment-only href goes through `[routerLink]` instead of a plain anchor. The router treats the whole string as a route. (link)
5. A `…h`-only srcset entry is invalid HTML, so the browser drops the whole source. A spec locks the wrong descriptor in as correct. (image)
6. `isContentfulGqlAsset` misclassifies a GQL asset with a null `url` or `size` as a REST asset. Four consumers then throw on `.fields.file`. (gql/asset guard)
7. The migration generator rewrites every `package.json` in scope, including unrelated ones, and reports none of them as changed. (generator)

---

## rich-text-renderer

### High

- **`domPosition` resets to 0 for every nested child, so a re-created node is appended, not inserted.**
  The default branch of `createRenderCommands` sets `domPosition = 0` before each child (`rich-text-renderer.component.ts:771-777`), so all siblings below root level share position 0. `findFollowingElement` (`:1037-1056`) only matches a cached command with a greater `domPosition`, so it never finds an anchor for nested nodes and `renderInsertOrAppend` always appends (`:1058-1068`). Verified at runtime: `<p>AB</p>` with `A` changed to `A2` renders `BA2`; `<p>ABC</p>` with `B` changed to `B2` renders `ACB2`. Only the root loop (`:804-806`) keeps distinct positions, which is why the root-level reorder specs pass.
- **The same defect reorders a preserved inline component past re-created text.**
  With `<p>[text][embedded-entry-inline]</p>`, a text change keeps the component (`samePlace` is true because both positions are 0, `:426-436`), deletes and re-creates the text span, and appends it after the component. Verified: `"before T"` becomes `"Trewritten "`. The spec at `rich-text-renderer.component.spec.ts:681-702` covers exactly this scenario but asserts only `toContain('rewritten')` — it encodes the bug.
- **A whitespace-only text node loses its content.**
  `runCreateInstruction` filters split segments with `.trim().length > 0` (`:857`). A node whose full value is `' '` passes the `if (!text) break` guard at `:519` but yields no segments, so an empty `<span>` is emitted with no text node (`:878-887`). Contentful emits this shape when an unmarked space separates two marked runs. Verified: `[bold:'bold'][' '][italic:'italic']` renders `bolditalic`.

### Medium

- **`entry-hyperlink` and `asset-hyperlink` render an anchor with no `href`.** Both map to `'a'` (`rich-text-renderer.util.ts:47-50`) but have no `case` in `createRenderCommands`, so they fall into `default:` (`:753-800`) and the target in `node.data.target` is never resolved. Verified: a dead `<a class="…">` comes out. `apps/docs/contentful/index.md:78` documents them as rendering links; no spec covers either type.
- **A leading `\n` emits an untracked `<br>` that duplicates on every re-render.** The `<br>` is appended straight to `parentElement` (`:863-866`), never stored in `executedCommandsCache`, and `runDeleteInstruction` (`:984-988`) removes only the span. Verified: `text('\nA')` → `text('\nB')` yields `<br><br><span>B</span>`. It also ignores `nextElement`, so the `<br>` lands at the end of the parent.
- **An empty `table-header-cell` is pruned, which misaligns table columns.** The prune guard exempts only `td` and `hr` (`:781`), not `th`. Verified: a row of `[th(empty), th('H2')]` renders one `<th>`, so every column shifts left. The spec at `rich-text-renderer.component.spec.ts:363-381` asserts the prune as intended.
- **A `javascript:` URI from the CMS is written unsanitized into `href`.** The no-link-component fallback builds `attributes.href = uri` (`:616, 638-643`) and applies it with `renderer.setAttribute` (`:898-900`), which bypasses Angular's URL sanitizer. Verified: `uri: 'javascript:alert(1)'` renders verbatim. The default config supplies `ContentfulLinkComponent`, so only consumers who pass `components: {}` or their own link component are exposed — a path `apps/docs/contentful/index.md:51` documents as supported.
- **`content.includes` is dereferenced without a guard.** `contentIncludesMap` reads `content?.includes.Asset` (`:308-310`); the optional chain guards `content`, not the `includes` key, which the REST API omits when a response has no linked entities. `ContentfulCollection` types `includes` as required (`contentful.types.ts:180-183`), so TS is silent. Verified: `TypeError` instead of the intended ET004 `RuntimeError`.

### Low

- Error codes ET007 (`text_parent_not_found`) and ET008 (`text_parent_wrong_type`) are dead (`rich-text-renderer.errors.ts:17-19, 30-31`) — no call site in the workspace, yet both are listed in the docs error table (`apps/docs/contentful/index.md:172-173`). The replacement paths throw bare `new Error(...)` with no code (`:915, 969, 1024, 1031`).
- `renderCommands` has no accessibility modifier (`:339`) while its siblings are `private`. The published `.d.ts` declares it and emits `RenderCommand`/`HtmlOpenRenderCommand`/`TextRenderCommand`/`ComponentRenderCommand` as non-exported declarations — readable but unnameable public surface. `richTextData` and `contentIncludesMap` are also public without being documented API.
- A legitimately absent rich-text field throws `rich_text_undefined` (`:326-330`) while a `null` `content` renders nothing (`:322-324`). The throw fires inside a computed read from an `effect` (`:484-488`), so it surfaces through `ErrorHandler` and the host cannot catch it.
- HTML and text render ids are positional counters (`:534, 643, 766`), unlike components, which key by entry/asset id. One inserted paragraph at the top shifts every later id, so the diff rebuilds the whole document. Correctness holds; the docs claim about minimal rebuilds (`apps/docs/contentful/index.md:83`) only holds for append-at-end edits.
- Comment-policy violations throughout: restating private-field JSDoc (`:296-306, 492-512`), algorithm narration (`:372-375, 456-465, 868, 1004-1005, 1038-1039`), mechanical rationale (`:415, 557-558, 618, 770, 782, 837, 926-927`), and `// #region` dividers in the spec (`:19, 84, 86, 158`).
- `renderInstructions` derives existing state from `previousRenderCommandMap` (`:354-364`), not from `executedCommandsCache`. If `execInstructions` (`:811-828`) throws mid-loop, the two desync permanently and every later render throws `'Cached command not found!'`. No reachable trigger was found — fragility, not a live bug.

Clean: no RxJS anywhere in the renderer — signals end to end, no subscriptions to leak. No stylesheet ships (the `et-contentful-rich-text-default-*` classes are consumer hooks), so the layer and color rules do not apply. Text goes through `renderer.createText` and tag names come from a closed map, so `href` is the only unsanitized sink. `createContentfulIncludeMap`, the marks helpers, and the `reflectComponentType`-based input binding are solid.

---

## components, gql, types, utils

### High

- **A `mailto:`, `tel:`, or fragment-only href routes through `[routerLink]`.**
  `ContentfulLinkComponent.isExternal` (`contentful-link.component.ts:42-44`) treats only `http://`, `https://`, and `//` prefixes as absolute; `internalPath` (`:75`) applies the same test. `mailto:sales@example.com` therefore falls into the `@else` branch (`:23`) and becomes `[routerLink]="mailto:sales@example.com"` — the router treats it as a route segment instead of opening the mail client. `tel:`, `#anchor`, and `ftp:` behave the same, and nothing upstream guards it.
- **A `…h`-only srcset entry is an invalid candidate, so the browser drops the whole source.**
  `contentful-image.component.utils.ts:114` builds `` `${url}&h=${height} ${height}h` ``. Per the HTML srcset parsing algorithm, an `h` descriptor without a `w` descriptor makes the candidate an error, so `srcsetSizes: ['300h', '600h']` yields `<source>` elements with zero usable candidates and a silent fallback to `defaultSrc`. The spec (`contentful-image.component.utils.spec.ts:84-88`) asserts the `300h` descriptor as correct, and `'400h'` is advertised in the JSDoc (`:38`) and in `contentful.types.ts:78`.
- **`isContentfulGqlAsset` misclassifies a GQL asset with a null `url` or `size`, and consumers then throw.**
  The guard (`asset.fragments.ts:33`) requires `url` truthy and `size` a number, but the narrowed type declares both as nullable (`:24, 28`). The false branch of the union narrows to `ContentfulRestAsset`, so `contentful-video.component.ts:38`, `contentful-audio.component.ts:41`, `contentful-file.component.ts:42`, and `contentful-image.component.utils.ts:20, 81` all compile — and all throw `Cannot read properties of undefined (reading 'file')` for a type-legal input. The spec (`contentful-image.component.utils.spec.ts:150-151`) characterizes the hole instead of catching it.

### Medium

- **`generateContentfulImageSources` never guards a null REST `file.url`.** `contentful-image.component.utils.ts:81` reads it (typed `string | null`, `contentful.types.ts:154`) with no check and interpolates it at `:104, 121`, so an unpublished asset yields the literal srcset `null?fm=avif&w=375 375w`. The sibling `generateDefaultContentfulImageSource` guards exactly this at `:20`.
- **`ContentfulImageComponent` injects `CONTENTFUL_CONFIG` non-optionally.** `contentful-image.component.ts:40` bypasses `injectContentfulConfig()` (`contentful-config.ts:53`), which exists to fall back to `CONTENTFUL_FALLBACK_CONFIG` — and which the link component uses. Standalone use without `provideContentfulConfig()` throws `NullInjectorError`, although the docs say the asset components work standalone.
- **`imageOptions.backgroundColor` is dead config.** Declared (`contentful.types.ts:93`), defaulted (`contentful-config.ts:22, 43`), documented (`apps/docs/contentful/index.md:44`) — and read by nothing. `contentful-image.component.ts:43` defaults the input to a literal `null`, unlike `srcsetSizes` and `sizes` which do read the config.
- **The file component opens a CMS-controlled URL with `target="_blank"` and no `rel`.** `contentful-file.component.ts:11`. The opened page keeps a `window.opener` handle and gets a referrer. The link component binds `rel` correctly (`contentful-link.component.ts:19`), so this is an inconsistency, not a policy.
- **The `image/jpg` source is a non-registered MIME type and unreachable anyway.** `SOURCE_TYPES` (`contentful-image.component.utils.ts:62`) lists it after `image/png`; `<picture>` picks the first supported type, so no browser reaches it. The practical fallback for pre-AVIF/WebP browsers is `fm=png`, which is several times the byte size of a JPEG for photos. The registered type is `image/jpeg` (compare `libs/core/src/lib/pipes/infer-mime-type.pipe.ts:75-77`).
- **The default srcset uses width descriptors with no `sizes` attribute.** `contentful-config.ts:20-21, 41-42` default `srcsetSizes` to four `w` entries and `sizes` to `[]`, which `normalizePictureSizes` turns into `null`. The `PictureSource` contract itself says `w` descriptors need `sizes` (`libs/components/src/lib/picture/picture.types.ts:16-18`); without it the browser assumes `100vw` and a sidebar thumbnail downloads the 2560w candidate.
- **Binding `[quality]` to a nullable expression emits `q=NaN`.** `contentful-image.component.ts:46` uses `numberAttribute`, which maps `null`/`undefined` to `NaN` on template writes. The guard at `contentful-image.component.utils.ts:92` is `quality !== null`, and `NaN !== null`, so `&q=NaN` lands in every candidate of all four sources.
- **`getPrimaryDomain` has no public-suffix awareness.** `contentful-link.component.ts:6-9` returns the last two labels, so `example.co.uk` and `attacker.co.uk` both yield `co.uk`. `openInNewTab` (`:55-70`) compares primary domains, so on a multi-label TLD every external link to a sibling suffix opens in the same tab with no `rel`. `isExternal` compares full hosts and is unaffected.

### Low

- A Tailwind utility is hardcoded in component source: `class="underline"` (`contentful-file.component.ts:11`). It only renders if the consuming app ships Tailwind.
- `isContentfulGqlAsset` returns a truthy value, not a boolean (`asset.fragments.ts:33`) — `undefined` or `''` escape through the `any`-typed predicate.
- The `data()` computeds of video (`:23`), audio (`:26`), and file (`:23`) are public by omission; the image component marks its equivalents `protected`. (`ethlete/template-member-accessibility` is off for this lib.)
- Video, audio, and file import `NgClass` where `[class]` would do; `libs/components` contains no `NgClass` at all.
- Dead code in the image source generator: `const assetData = data; if (!assetData) return [];` on a non-nullable, already-guarded input (`contentful-image.component.utils.ts:72-76`), plus a code-restating comment at `:85`.
- `provideContentfulConfig` has no `Provider` return type (`contentful.util.ts:5-7`) and its argument is defaulted three times (`contentful.util.ts:5`, `contentful-config.ts:27, 46`).
- The workaround comment at `contentful-config.ts:29` ("some weird webpack reason") names no concrete cause and is contradicted by `CONTENTFUL_FALLBACK_CONFIG` twenty lines above, which is the same shape in a const.
- Styling hooks are inconsistent: only the image component sets a host class; video/audio/file declare `ViewEncapsulation.None` with no stylesheet and no `et-` host class; the link component ships an inline `display: contents` host style (only overridable with `!important`) and hardcodes rich-text classes into standalone use (`contentful-link.component.ts:29, 88`).
- `ContentfulFileComponent.data()` computes a `contentType` (`:33, 41`) the template never renders. The size label is hardcoded English with no unit scaling: `{{ data.size }} Bytes` (`:13`).
- `generateContentfulImageSources` takes six positional parameters, five nullable (`contentful-image.component.utils.ts:64-71`); `max-params` is disabled for exactly this function.
- The GQL fragment name `AssetData` (`asset.fragments.ts:4`) is unnamespaced; a consumer's own `AssetData` fragment collides at the document level. Every other exported symbol is `Contentful`-prefixed.

Clean: the GQL fragment matches `ContentfulGqlAsset` field for field. No BehaviorSubject/Subject/`.subscribe()` anywhere, no manual subscriptions, no hardcoded colors, no `innerHTML`, no `bypassSecurityTrust*`, no Promise-based public API. Barrels are consistent, and the link component's absence from `ContentfulImports` is deliberate and documented. `isContentfulEntryType` is correct.

---

## generator, stories, packaging

### High

- **The migration generator rewrites every `package.json` in scope, unrelated ones included.**
  `migratePackageJson` runs for any file named `package.json` (`generators/migrate-to-contentful-v5/migration.ts:222`) and calls Nx `updateJson` unconditionally (`:152`), which always re-serializes with 2-space indent and strips JSON comments — the early `return json` at `:161` does not prevent the write. Verified: an unrelated `package.json` with 4-space indent came out reformatted and recorded as a git change. The default scope is the whole workspace (`migration-scope.ts:45-50`), `filesChanged` only counts real dependency adds (`:227`), and the report never mentions the rewrites.

### Medium

- **The `useTailwindClasses` removal only matches a whole line.** `USE_TAILWIND_CLASSES_REGEX` (`migration.ts:93`) is anchored `^[ \t]*…\r?\n` under `gm`. Verified: a single-line `provideContentfulConfig({ useTailwindClasses: true, internalHosts: [] })` — the shape Prettier at `printWidth: 120` produces — is left byte-identical with no report entry, while the report header claims the option was removed.
- **Removed-export detection misses re-exports, default+named imports, and namespace imports.** `CONTENTFUL_IMPORT_REGEX` (`migration.ts:34`) requires `import` then `{`. Verified: `export { RENDER_COMMAND_TYPE } from '@ethlete/contentful'` produces no tasks file at all — and a barrel re-export is the most likely real-world shape. Aliased and `type` imports are handled correctly.
- **The docs show a `createContentfulIncludeMap` signature that does not exist.** `apps/docs/contentful/index.md:110` says `createContentfulIncludeMap({ includes })`; the real signature takes `{ entries, assets }` (`rich-text-renderer.component.ts:205-209`). The documented form does not compile.
- **`vite` and `@analogjs/vite-plugin-angular` are published as (optional) peers only because of `vite.config.mts`.** `libs/contentful/package.json:7, 16`; the only importer is the test-time config. `libs/components` avoids this by adding `vite.config.*` to the `@nx/dependency-checks` `ignoredFiles`; `libs/contentful/eslint.config.mjs:13` only ignores `eslint.config.*`. Same pattern exists in `core`, `query`, and `cdk`.

### Low

- The `<et-contentful-image>` tag regex (`migration.ts:32`) truncates at a `>` inside an attribute value, so `[sizes]="w > 5 ? … "` stops the rename for later attributes. Verified. Multi-line tags work.
- The generator adds `@ethlete/components` to dependencies (`migration.ts:166`) but returns `void` — no `installPackagesTask`, so the lockfile stays stale until the user notices.
- Overlapping `--projects` and `--include` visit files twice and duplicate report entries (`migration-scope.ts:52-57`). The rename itself is idempotent.
- `apps/docs/contentful/index.md` embeds no stories, although `contentful-rich-text--embedded-entries`, `--lists`, and `--tables` are registered in Storybook and nearly every other guide uses `<StoryEmbed>`.
- The story image fixture declares 640×360 (`stories/rich-text-fixtures.ts:46`) for a 500×250 SVG, and its empty `description` (`:41`) means no story ever exercises the `figcaption` path.
- Two `TODO(styleguide)` comments with no issue link in `libs/contentful/eslint.config.mjs:30-37` (disabling `template-member-accessibility` and `max-params`). Both are informative; the fix is a link, not deletion.

Clean: `generators/dist/` is git-ignored and never committed, and the working-tree copy matches the source. `nx lint contentful`, `nx test contentful` (110 tests), and `nx build contentful` all pass. Packaging mirrors `components` (ng-package asset globs, `build-generators` target, `"type": "module"` in the dist package). `sideEffects: false` is safe — the lib ships no CSS. All Tailwind classes in the stories exist in the trimmed Storybook theme, all three stories render with a clean console, and the interactions work. The README and the docs guide are otherwise current with v5 and wired into the VitePress sidebar.

### Spec coverage

- `migration.spec.ts` (7 tests) covers the rename forms, multi-line `useTailwindClasses`, plain named removed-import reporting, and the dependency add. Every case above that the implementation gets wrong is uncovered: single-line `useTailwindClasses`, re-export/namespace/default+named imports, `>` inside an attribute value, the untouched-`package.json` case, and overlapping scope flags.
- `contentful-image.component.utils.spec.ts` is thorough for the three util functions, but two assertions lock in defects: the `300h` descriptor (`:87`) and `parseContentfulImageSize('abc')` → `{ width: NaN, height: null }` under a `number | null` signature (`:64-66`).
- There are **zero** tests for all five components, for the config helpers, and for `isContentfulGqlAsset`. The largest gap is `ContentfulLinkComponent`: `getPrimaryDomain`, `isExternal`, `openInNewTab`, and `internalPath` carry all the URL-classification logic and none of it is exercised — a handful of unit tests would catch both High link findings.
- The renderer specs (814 + 182 lines) have good breadth, but every nested-sibling ordering assertion is order-insensitive (`toContain`), which is exactly how the two High reorder bugs stay green. Also uncovered: whitespace-only text nodes, `entry-hyperlink`/`asset-hyperlink`, leading-`\n` re-renders, a response with no `includes`, and 3 of the 7 mark types.

---

## Cross-cutting themes

1. **Specs that encode the bug.** The order-blind reattach spec, the empty-`th` prune spec, the `300h` descriptor spec, the `NaN` size spec, and the GQL-asset-without-url spec all assert current wrong behavior. When one of these is fixed, fix the spec in the same change.
2. **Null-legal fields, null-free code.** The types declare `url`, `size`, and `file.url` as nullable and `includes` as required; the code assumes the opposite in both directions. `isContentfulGqlAsset`, `generateContentfulImageSources`, and `contentIncludesMap` all need one decision: make the types honest or guard the reads.
3. **URL and link handling deserves one consolidated pass.** The `mailto:` routing bug, the unsanitized `javascript:` href sink, the `target="_blank"` without `rel` on the file component, and the public-suffix gap in `getPrimaryDomain` are all one topic: what the SDK does with a CMS-controlled URL.
4. **Config consumption is inconsistent.** One component injects the token non-optionally while the helper built for the fallback exists and is used next door; `backgroundColor` is defaulted and documented but read by nothing.
5. **The five asset components have zero specs.** All component-level High and Medium findings in this scan sit in untested code; the utils, the only tested area, had the fewest problems.
6. **The image `<picture>` output is suboptimal end to end.** Invalid `h` descriptors, `w` descriptors without `sizes`, an unreachable `image/jpg` source, and a PNG fallback for photos compound into oversized downloads even when nothing crashes.
