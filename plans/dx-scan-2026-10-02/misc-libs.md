# misc-libs — DX scan 2026-10-02

Scope: `libs/contentful`, `libs/types`, `libs/query-devtools` (`.`, `/lazy`, `/toggle`), `apps/docs/contentful`,
`apps/docs/types`, `apps/docs/query-devtools`

| ID      | Sev    | Kind     | Decision | Title                                                                                     |
| ------- | ------ | -------- | -------- | ----------------------------------------------------------------------------------------- |
| MISC-01 | High   | bug      | no       | Fragment-only and relative rich-text links resolve against `<base href>`, not the page    |
| MISC-02 | Medium | dx       | no       | `imageOptions` is documented as partial but typed as all-required                         |
| MISC-03 | Medium | bug      | no       | Default-components migration skips apps that never called `provideContentfulConfig`       |
| MISC-04 | Medium | dx       | no       | A `richTextPath` typo renders nothing, silently                                           |
| MISC-05 | Medium | dx       | no       | ET000 says "is undefined" when the value is defined but not an object                     |
| MISC-06 | Medium | dx       | no       | Devtools panel / shell give no hint when `provideQueryDevtools()` is missing              |
| MISC-07 | Medium | dx       | yes      | `@ethlete/query-devtools` exports its internals as public API                             |
| MISC-08 | Medium | dx       | yes      | Rich-text renderer cannot render a GraphQL rich-text field                                |
| MISC-09 | Low    | dx       | no       | Migration descriptions name the removed `withContentfulDefaultComponents()`               |
| MISC-10 | Low    | dx       | no       | Contentful error-code table lists codes that do not exist                                 |
| MISC-11 | Low    | dx       | no       | A missing embedded entry warns twice                                                      |
| MISC-12 | Low    | dx       | no       | Invalid image `srcsetSizes` / `backgroundColor` values fail silently                      |
| MISC-13 | Low    | dx       | yes      | Contentful asset components disagree on class inputs                                      |
| MISC-14 | Low    | dx       | no       | `@ethlete/query-devtools` peer-depends on `@ethlete/types`, which only stories import     |
| MISC-15 | Low    | dx       | no       | Stale docs: devtools bundle numbers, types page names cdk bracket, types README is a stub |
| MISC-16 | Low    | test-gap | no       | No bundle golden guards the `/lazy` shell's initial cost                                  |

## MISC-01 Fragment-only and relative rich-text links resolve against `<base href>`, not the page

- Status: fixed (also: `[target]`/`[rel]` property bindings wrote `target="null"` on every plain anchor; now attribute bindings)
- Review: ok (changeset split into lines under ~40 words)

- Where: `libs/contentful/src/lib/components/link/contentful-link.component.ts:52` (fragment goes to the plain
  anchor), `:13-20`; renderer fallback anchor `libs/contentful/src/lib/components/rich-text-renderer/rich-text-renderer.component.ts:130-143,585`.
- Problem: Angular apps ship `<base href="/">`. A Contentful hyperlink `#comments` (a table-of-contents link) on
  `/news/article-1` is rendered as `<a href="#comments">`, which the browser resolves against the base URL to
  `/#comments` - a full page load of the home page instead of a scroll. The link spec only asserts that `#section`
  renders a plain anchor (`contentful-link.component.spec.ts:34`), never where it goes. Without `components.link`
  (no `CONTENTFUL_DEFAULT_COMPONENTS` spread) the renderer's fallback anchor does the same for `#x`, and also for
  `?page=2`, `./next` and `../list`, which the docs claim resolve against the router URL (that claim holds only for
  the link component).
- Fix: in `ContentfulLinkComponent`, route fragment-only hrefs through `[routerLink]` with the current path
  (`this.url()` without hash) plus `[fragment]`, or render `href` as `<current path + search>#frag`. In the
  renderer fallback, resolve non-absolute hrefs against the router URL the same way (`new URL(href, origin + routerUrl)`)
  before writing `href`. Add a spec that sets a base href / router URL and asserts the resolved href. Update the
  Links section of `apps/docs/contentful/index.md`.
- Breaking: no. Decision: no.

## MISC-02 `imageOptions` is documented as partial but typed as all-required

- Status: fixed
- Review: ok

- Where: `libs/contentful/src/lib/types/contentful.types.ts:73-99`; runtime merge `libs/contentful/src/lib/utils/contentful-config.ts:30`;
  the spec has to cast: `libs/contentful/src/lib/utils/contentful-config.spec.ts:35` (`{ sizes: ['50vw'] } as never`).
- Problem: `ContentfulConfigOptions = Partial<ContentfulConfig>` is shallow, so
  `provideContentfulConfig({ imageOptions: { sizes: ['50vw'] } })` is a type error ("srcsetSizes, backgroundColor
  missing") although the docs say `imageOptions` merges one level deep and the runtime does merge it.
- Fix: `export type ContentfulConfigOptions = Partial<Omit<ContentfulConfig, 'imageOptions'>> & { imageOptions?: Partial<ContentfulConfig['imageOptions']> };`
  and drop the `as never` from the spec.
- Breaking: no. Decision: no.

## MISC-03 Default-components migration skips apps that never called `provideContentfulConfig`

- Status: fixed
- Review: ok

- Where: `libs/contentful/generators/migrate-contentful-default-components/contentful-default-components.ts:45-49`.
- Problem: the provider was documented as optional, and before `f29b2eccc` the fallback config registered the
  five components. An app that renders `<et-contentful-rich-text-renderer>` without any provider now silently loses
  every embedded asset (only a dev-mode warning per asset) and every router link. The scan returns early for any
  file that does not import `provideContentfulConfig`, so `et update` reports "Nothing to do" for exactly that app.
- Fix: when the workspace has no `provideContentfulConfig` call but some file imports
  `ContentfulRichTextRendererComponent` or `ContentfulImports`, add a task to
  `contentful-default-components-migration-tasks.md` naming that file and telling the user to add
  `provideContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS })`. Add a migration spec for it.
- Breaking: no. Decision: no.

## MISC-04 A `richTextPath` typo renders nothing, silently

- Status: fixed
- Review: ok

- Where: `libs/contentful/src/lib/components/rich-text-renderer/rich-text-renderer.component.ts:332-336`.
- Problem: `richTextPath="items[0].fields.body"` when the field is `html` resolves to `undefined` and the renderer
  returns `null` - empty host, no warning. The same happens for `item[0]...` or an `items[1]` that does not exist.
  "Absent field renders nothing" is right for an empty optional field, but a path whose parent object is missing is
  almost always a typo.
- Fix: in dev mode, when the resolved value is `undefined`, check whether the parent path (everything before the
  last segment) resolves to an object; if it does not, `console.warn` once per path with the path and the deepest
  segment that resolved. Keep the silent path for a missing leaf field. Spec both cases.
- Breaking: no. Decision: no.

## MISC-05 ET000 says "is undefined" when the value is defined but not an object

- Status: fixed (message built from the data; key `rich_text_not_object`)
- Review: ok

- Where: `libs/contentful/src/lib/components/rich-text-renderer/rich-text-renderer.errors.ts:4-5`, thrown at
  `rich-text-renderer.component.ts:338-339`.
- Problem: ET000 is only thrown when the value at `richTextPath` exists and is a primitive (e.g. the path points
  at `items[0].fields.title`, or at a stringified JSON field). The message says "The property value given at
  richTextPath is undefined", which sends the developer looking for a missing field. The docs table
  (`apps/docs/contentful/index.md`, Error codes) describes it correctly; the message does not.
- Fix: rename the key to `rich_text_not_object` and change the message to "The value at richTextPath is a <typeof>,
  not a rich-text document object. Point richTextPath at the rich-text field itself (e.g. items[0].fields.body)."
  Include `typeof` in the data. Keep code 0.
- Breaking: no. Decision: no.

## MISC-06 Devtools panel / shell give no hint when `provideQueryDevtools()` is missing

- Status: fixed
- Review: ok

- Where: `libs/query-devtools/lazy/query-devtools-lazy.component.ts:60,86`; `libs/query-devtools/src/lib/query-devtools.component.ts:603-610,1207`.
- Problem: forgetting the provider (or putting it in the wrong `bootstrapApplication`) makes
  `<et-query-devtools-lazy>` render nothing at all, and `<et-query-devtools>` open an empty panel. Neither says why;
  the only hint is a JSDoc sentence. This is the first thing a new consumer gets wrong.
- Fix: in dev mode only (`isDevMode()`), when `isQueryDevtoolsEnabled()` is false at construction, `console.warn`
  once: "<et-query-devtools-lazy>: provideQueryDevtools() is not in the application providers, so the devtools render
  nothing. Add it to bootstrapApplication's providers." Same for the eager panel, plus an empty-state line in the
  Queries tab. Production builds (the documented "leave the shell mounted" case) stay silent. Extend
  `tests/query-devtools-lazy.spec.ts` (mind the latch ordering noted there).
- Breaking: no. Decision: no.

## MISC-07 `@ethlete/query-devtools` exports its internals as public API

- Status: fixed (decision: entry exports only `QueryDevtoolsComponent`, `QUERY_DEVTOOLS_IMPORTS`, `QUERY_DEVTOOLS_VERSION`; `/toggle` exports stay, the other two entries import them)
- Review: ok

- Where: `libs/query-devtools/src/lib/index.ts:1-8`; e.g. `query-devtools-json.component.ts:22,35` (`JsonKind`,
  `kindOf`), `query-devtools.component.ts:376,390,414` (`clampFloatToPeek`, `settledFloatRect`, `resizedFloatRect`),
  `QueryDevtoolsJsonComponent`, `QueryDevtoolsJsonStylesComponent`, `QueryDevtoolsTimelineStylesComponent`,
  `QueryDevtoolsSettingsComponent`, `QueryDevtoolsAboutComponent`, `QUERY_DEVTOOLS_IMPORTS`; ~70 `public` signals on
  `QueryDevtoolsComponent` (`:827-899`).
- Problem: autocomplete on `@ethlete/query-devtools` offers a generic `kindOf`, float-geometry helpers and building-block
  components none of the docs mention; every refactor of the panel is technically a breaking change. Only
  `QueryDevtoolsComponent` (and maybe the version constant) is documented.
- Fix: export only `QueryDevtoolsComponent` and `QUERY_DEVTOOLS_VERSION` from the entry; specs import the rest by
  relative path. Mark the panel's cross-component signals `/** @internal */` or move them to an injected state
  service. Decide whether `QueryDevtoolsAboutComponent`/`QueryDevtoolsSettingsComponent` are meant to be embeddable.
- Breaking: yes. Decision: yes (which pieces, if any, stay public).

## MISC-08 Rich-text renderer cannot render a GraphQL rich-text field

- Status: open: needs the input-shape decision

- Where: `libs/contentful/src/lib/components/rich-text-renderer/rich-text-renderer.component.ts:306,316-322`;
  `libs/contentful/src/lib/gql/asset.fragments.ts` (GQL helpers exist).
- Problem: the package ships GQL helpers (`GQL_FRAGMENT_CONTENTFUL_ASSET`, filter variables) and `@ethlete/types` has
  `ContentfulGqlLikePaginated`, but the renderer only takes a REST `ContentfulCollection` with `includes`. A GraphQL
  rich-text field is `{ json, links: { assets: { block, hyperlink }, entries: { block, inline, hyperlink } } }`; a GQL
  consumer has to hand-build a fake collection (with REST-shaped `sys.contentType`) to get embedded entries/assets.
- Fix: add an input pair (e.g. `[gqlRichText]` taking `{ json, links }`) or a `createContentfulIncludeMapFromGqlLinks()`
  helper plus a `document`+`includes` input mode, mapping `__typename` to the content-type id. Needs a design call on
  the input shape.
- Breaking: no. Decision: yes.

## MISC-09 Migration descriptions name the removed `withContentfulDefaultComponents()`

- Status: fixed
- Review: ok

- Where: `libs/contentful/migrations.json:17`, `libs/contentful/generators/generators.json:11`,
  `libs/contentful/generators/migrate-contentful-default-components/schema.json:4`.
- Problem: `et update` and `nx g --help` describe the migration as "Add withContentfulDefaultComponents()", an API that
  was replaced by the `CONTENTFUL_DEFAULT_COMPONENTS` spread (`9c47d64d5`). A developer greps for it and finds nothing.
- Fix: reword all three to "Spread CONTENTFUL_DEFAULT_COMPONENTS into provideContentfulConfig, and report the calls
  that need it by hand."
- Breaking: no. Decision: no.

## MISC-10 Contentful error-code table lists codes that do not exist

- Status: fixed
- Review: ok

- Where: `apps/docs/contentful/index.md` (Error codes: ET008, ET011) vs
  `libs/contentful/src/lib/components/rich-text-renderer/rich-text-renderer.errors.ts:19-27` (0, 1, 2, 3, 7, 9, 10).
- Problem: ET008 ("parent is neither an HTML element nor a custom component") and ET011 ("parent lookup hit a missing
  render command") are documented but never thrown.
- Fix: delete the two rows (or restore the checks if they still guard something).
- Breaking: no. Decision: no.

## MISC-11 A missing embedded entry warns twice

- Status: fixed
- Review: ok

- Where: `rich-text-renderer.component.ts:233-235` (`getEntry` warns "Entry not found! ... include query param too
  low?") and `:694-701` (renderer warns "Embedded entry is missing from the includes!").
- Problem: every unpublished/deleted embedded entry produces two warnings with different wording, and the first one
  logs the whole `entryMap`.
- Fix: have the renderer look up `entryMap` without the warning (an internal `peekEntry`), keeping one warning that
  names both causes (unpublished/deleted, or `include` depth too low).
- Breaking: no. Decision: no.

## MISC-12 Invalid image `srcsetSizes` / `backgroundColor` values fail silently

- Status: fixed
- Review: ok

- Where: `libs/contentful/src/lib/components/image/contentful-image.component.utils.ts:43-62,102-104,121-131`.
- Problem: `srcsetSizes: ['50vw']` (a `sizes` value in the wrong option) parses to `{ null, null }` and is dropped, so
  the image falls back to one unsized URL; a height-only size without asset dimensions is dropped the same way.
  `backgroundColor: '#ff0000'` produces `bg=rgb:#ff0000`, which the Images API rejects. No warning in either case.
- Fix: in dev mode warn on an unparseable size and on a dropped height-only size; strip a leading `#` from
  `backgroundColor` (or warn). Spec it.
- Breaking: no. Decision: no.

## MISC-13 Contentful asset components disagree on class inputs

- Status: fixed (2026-10-06, static classes, inputs dropped, et update migration `contentful-asset-classes`; link gained `marks`/`richText` inputs for the renderer; 8faa5f989)

- Where: `contentful-video.component.ts:24` (`videoClass: NgClassType`), `contentful-audio.component.ts:25-27`
  (three `NgClassType` inputs), `contentful-file.component.ts:30` (`fileClass`), `contentful-link.component.ts:38-39`
  (`textClass`/`anchorClass: string`), image has none (`contentful-image.component.ts`, docs: "target the static
  classes instead").
- Problem: the v5 image rewrite removed class passthroughs in favour of static classes, but the four siblings keep
  `NgClass` inputs with a different type than link's string inputs. A consumer styling all five has to learn three
  conventions.
- Fix: pick one: either static `et-contentful-*` classes on every inner element (drop the inputs, as image did) or
  string class inputs everywhere. Update the docs' "Video, audio, file" list.
- Breaking: yes. Decision: yes.

## MISC-14 `@ethlete/query-devtools` peer-depends on `@ethlete/types`, which only stories import

- Status: fixed (`checkObsoleteDependencies` now on)
- Review: ok

- Where: `libs/query-devtools/package.json` (`"@ethlete/types": "^2.0.0-beta.4"`); the only import is
  `libs/query-devtools/src/lib/stories/query-devtools-demo.utils.ts:28`. `checkObsoleteDependencies: false` in
  `libs/query-devtools/eslint.config.mjs` hides it.
- Problem: every consumer gets a peer-dependency warning / install requirement for a package the shipped code never
  imports.
- Fix: drop the peer dependency, run `yarn install`, and consider enabling `checkObsoleteDependencies` for this lib.
- Breaking: no. Decision: no.

## MISC-15 Stale docs: devtools bundle numbers, types page names cdk bracket, types README is a stub

- Status: fixed (AGENTS.md still says ~125 kB / ~3 kB; outside this slice)
- Review: fixed AGENTS.md devtools numbers (~184 kB / ~5 kB, measured with tools/treeshake)

- Where: `apps/docs/query-devtools/index.md:79-89` ("~125 kB gz", table 48.3 / 142.4 / 63.1 kB) vs
  `tools/treeshake/goldens.json:35-37` (panel alone 184010 B gz); `apps/docs/types/index.md` last paragraph
  ("`@ethlete/cdk`'s bracket component consumes the tournament structure views" - it is now the `components`
  bracket/match/standings `integrations/ethlete`); `libs/types/README.md` is the Nx-generated stub ("Run `nx test
types`"), which is what npm shows.
- Fix: re-measure and update the devtools numbers (or link the goldens); point the types page at the components
  integrations; replace the types README with a three-line description and the docs link.
- Breaking: no. Decision: no.

## MISC-16 No bundle golden guards the `/lazy` shell's initial cost

- Status: fixed (`query-devtools-lazy` golden, `initialChunk: true` keeps dynamic imports external: 4969 B)
- Review: ok

- Where: `tools/treeshake/goldens.json` has `query-devtools-panel` and `query-devtools-toggle` but no
  `@ethlete/query-devtools/lazy` entry, although `tools/treeshake/harness.mjs:43` maps it and AGENTS.md says the
  ~3 kB up-front number is guarded.
- Problem: the toggle golden measures the toggle entry, not the shell. A change that makes the shell reference
  `QueryDevtoolsComponent` outside the `@defer` (or a new static import in `/lazy`) pulls the whole panel into the
  initial bundle and no check fails.
- Fix: add a `query-devtools-lazy` golden that measures only the initial chunk of
  `import { QueryDevtoolsLazyComponent } from '@ethlete/query-devtools/lazy'` (exclude the dynamic-import chunk), or
  assert in the harness that the lazy entry's FESM contains `import('@ethlete/query-devtools')` and no static import of it.
- Breaking: no. Decision: no.
