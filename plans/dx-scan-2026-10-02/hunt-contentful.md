# hunt-contentful — bug hunt 2026-10-10

Scope: `libs/contentful` (rich-text renderer, gql mapping, types, image/asset components, link component).
Read-only hunt. Checked against `git log -60 -- libs/contentful` (the DX-scan fixes up to `07534d4aa`); none of
the findings below is covered by a recent commit or by `rich-text-renderer.component.spec.ts`.

Looked at and found sound: the diff/reconcile pass (parent-preserved check, move vs create, delete order), empty
element pruning (documented, td/th/hr kept), mark nesting and order, `\n` → `<br>`, unsafe-scheme filtering in
`normalizeHref`, missing linked entries/assets (skipped with a dev warning), protocol-relative REST asset URLs in
asset hyperlinks, image srcset params. Circular references cannot loop today, but only because nested rich text
cannot be wired at all (HCF-06).

| ID     | Sev    | Kind | Decision | Title                                                                                                 |
| ------ | ------ | ---- | -------- | ----------------------------------------------------------------------------------------------------- |
| HCF-01 | High   | bug  | no       | An embedded entry that is also in `items` is skipped as "missing from the includes"                   |
| HCF-02 | Medium | bug  | no       | GraphQL embeds of a content type with `-` or `_` in its id never find their custom component          |
| HCF-03 | Medium | bug  | no       | SSR + hydration: the imperative render is appended next to the server DOM, no SSR coverage            |
| HCF-04 | Medium | dx   | yes      | An `entry-hyperlink` can never become a link, and the docs give advice that cannot be followed        |
| HCF-05 | Medium | bug  | yes      | An `internalHosts` subdomain link is router-navigated to its path in the current app, host dropped    |
| HCF-06 | Medium | dx   | yes      | Rich text inside an embedded REST entry cannot be rendered with its embeds                            |
| HCF-07 | Low    | dx   | no       | `embedded-resource-*` nodes render nothing, while the warning and the docs say "rendered as div/span" |

## HCF-01 An embedded entry that is also in `items` is skipped as "missing from the includes"

- Where: `libs/contentful/src/lib/components/rich-text-renderer/rich-text-renderer.component.ts:357-371`
  (`includes` / `includedEntries` read only `content.includes.Entry`), lookup at `:772`; same map handed to
  custom components as `includes` at `:815`.
- Problem: the CDA does not repeat an entry in `includes.Entry` when it is already in `items`. Contentful's own
  resolver merges both for that reason (`contentful-resolve-response`:
  `const allEntries = [...responseClone.items, ...allIncludes]`). Repro: `GET /entries?content_type=article&limit=10`
  returns articles A and B; A's body embeds B (a "related article" block). The renderer for A's body finds B in
  neither map, logs "Embedded entry is missing from the includes! … unpublished or deleted" and drops it - a
  misleading message for a published entry. The same applies to `ContentfulIncludeMap.getEntry` inside custom
  components and to `createContentfulIncludeMap` as documented in `apps/docs/contentful/index.md:140`.
- Fix: build the entry list from `[...content.items, ...(content.includes?.Entry ?? [])]` (includes win on a
  duplicate id). Update the docs snippet at `index.md:140` the same way. Spec: a collection with two items where
  item 0's rich text embeds item 1 and `includes` is omitted renders the custom component once.
- Breaking: no. Decision: no.
- Status: fixed - entries resolve against `items` + `includes.Entry` (includes win); docs snippet updated.

## HCF-02 GraphQL embeds of a content type with `-` or `_` in its id never find their custom component

- Where: `rich-text-renderer.gql.ts:32` (`lowerCaseFirst`), `:68`; docs claim at
  `apps/docs/contentful/index.md:230`; lookup `rich-text-renderer.component.ts:787`.
- Problem: Contentful builds the GraphQL type name by PascalCasing the content type id and stripping
  separators (`product-teaser` and `product_teaser` both become `ProductTeaser`; verify the exact rule in the
  GraphQL "schema generation / types" reference, the docs site rate-limited this scan). Lower-casing the first
  letter only inverts ids that were already camelCase. With
  `customComponents: { 'product-teaser': TeaserComponent }` and `gqlRichText`, the lookup key is
  `productTeaser`, so every embed is skipped with "No custom component registered" although the same config
  works for the REST path. An id that starts upper-case (`Article`) fails the same way.
- Fix: resolve by matching instead of inverting - in `toRestEntry` (or at lookup time for GQL), pick the
  `customComponents` key whose PascalCase form (`key.replace(/[^a-z0-9]+(.)?/gi, (_, c) => c?.toUpperCase() ?? '')`
  with the first letter upper-cased) equals `__typename`; fall back to `lowerCaseFirst`. Correct the docs sentence.
  Spec: `__typename: 'ProductTeaser'` with a `product-teaser` key renders the component.
- Breaking: no. Decision: no.
- Status: fixed - GQL `__typename` is matched against the PascalCase form of each `customComponents` key, falling back to lower-casing the first letter.

## HCF-03 SSR + hydration: the imperative render is appended next to the server DOM, no SSR coverage

- Where: `rich-text-renderer.component.ts:319-326` (no `ngSkipHydration`, empty template), `:529-534` (effect
  renders into an empty `executedCommandsCache`), `:1091-1100` (`renderInsertAfter` inserts before
  `parentElement.firstChild` and never clears the host), `:932-936` (embedded components created in the host's
  `ViewContainerRef`, then their root nodes moved into `<p>`/`<li>` elements).
- Problem: on the server the effect renders the full tree into the host. With `provideClientHydration()`, Angular
  claims only template nodes; the host's template is empty, so the server-rendered `<p>`/`<span>` nodes are left
  in place, and the client effect inserts a second full copy before them. The embedded components are worse: the
  hydration annotations describe them as views of the host container, but their DOM has been moved into
  renderer-created elements, so hydration either fails to match (NG05xx) or leaves orphaned server nodes. Nothing
  in the lib or the docs mentions SSR, and there is no SSR spec. Not reproduced here (`@angular/platform-server`
  is not installed in the repo) - confirm with a `renderApplication` + hydrate spec before fixing.
- Fix: add `ngSkipHydration: 'true'` to the host (the documented opt-out for components that manipulate the
  DOM directly), so the client destroys and re-renders the component; optionally clear stray host children on
  the first client render. Add a spec that renders on the server (or simulates pre-existing host children) and
  asserts the text appears once.
- Breaking: no. Decision: no.
- Status: fixed (not verified in SSR) - host carries `ngSkipHydration`, so Angular clears the server DOM of the host and re-renders on the client. `@angular/platform-server` is not installed; the spec only asserts the attribute.

## HCF-04 An `entry-hyperlink` can never become a link, and the docs give advice that cannot be followed

- Where: `rich-text-renderer.component.ts:653-665` (`href` stays `null` for `ENTRY_HYPERLINK`, the children render
  as plain text at `:728-733`); `apps/docs/contentful/index.md:100` and `:189` ("render entry links through a
  custom embedded-entry component when the content model defines routing").
- Problem: an `entry-hyperlink` is an inline hyperlink node, not an embedded entry, so `customComponents` is never
  consulted for it. An editor who links "our pricing page" to the Page entry gets plain text on every site, and the
  docs send the developer to a mechanism that does not apply. The GraphQL mapping even collects
  `links.entries.hyperlink` (`rich-text-renderer.gql.ts:94`) for nothing.
- Fix: add a config hook, e.g. `entryHref?: (entry: ContentfulEntry) => string | null` in `provideContentfulConfig`,
  resolved against `includedEntries()`; a returned href goes through the same `normalizeHref` → link component /
  fallback anchor path as `hyperlink`. Without the hook keep today's text. Fix the docs sentence either way.
- Breaking: no. Decision: yes (API shape: config function vs. a `customComponents`-style entry-link component).
- Status: fixed - `entryHref` config hook; its href goes through `normalizeHref` and the link component / fallback anchor.

## HCF-05 An `internalHosts` subdomain link is router-navigated to its path in the current app, host dropped

- Where: `link/contentful-link.util.ts:23-33` (subdomain match), `link/contentful-link.component.ts:45-80`
  (`usesRouterLink` → `routerLink` built from `url.pathname` only); fallback anchor in
  `rich-text-renderer.component.ts:677-688` keeps the full href.
- Problem: with `internalHosts: ['example.com']` (the JSDoc example) on `www.example.com`, a hyperlink to
  `https://shop.example.com/cart` is "internal", so `ContentfulLinkComponent` renders
  `<a routerLink="/cart">` - a click navigates this SPA to its own `/cart` (usually a 404 route) instead of the
  shop. The protocol and port of the configured host are ignored too. Without the link component the same href
  renders as a plain anchor to the shop in the same tab, so the two documented paths disagree.
- Fix: only router-navigate when the URL's host equals the current host or exactly matches a configured host;
  treat a subdomain match as "same site" (no `target="_blank"`) but keep a full `href`. Alternatively drop the
  implicit subdomain rule and let the app list hosts (`'*.example.com'` opt-in). Spec in
  `contentful-link.component.spec.ts`.
- Breaking: yes (subdomain links stop using the router). Decision: yes.
- Status: fixed (breaking) - `internalHosts` match the host exactly, `*.example.com` opts into subdomains, a port in an entry is required; the fallback anchor of an internal absolute URL now points at the same app path the link component routes to.

## HCF-06 Rich text inside an embedded REST entry cannot be rendered with its embeds

- Where: `rich-text-renderer.component.ts:811-816` (custom components get `fields` and a
  `ContentfulIncludeMap` of functions), `:340-346` (the renderer only accepts a `ContentfulCollection` +
  `richTextPath` or `gqlRichText`); `types/contentful.types.ts:30-38`.
- Problem: a common model is a "Section" entry embedded in a page, with its own rich-text `body` that embeds
  images. The custom component holds `fields.body` but cannot render it: `content` needs a full collection with
  raw `includes.Entry/Asset` arrays, which the include map does not expose, and `richTextPath` needs a path the
  component does not know. The workaround (`[content]="{ items: [{ fields }], includes: ??? }"`) renders the text
  but drops every embed. Once this is possible, an entry A → B → A chain would recurse without a guard.
- Fix: add an input pair for a bare document plus resolved links, e.g. `richText` (a `RichTextResponse`) and
  `includes` (`ContentfulIncludeMap`), so a custom component can write
  `<et-contentful-rich-text-renderer [richText]="fields().body" [includes]="includes()" />`; pass a depth/ancestor
  set through DI and skip an entry that is already an ancestor (dev warning).
- Breaking: no. Decision: yes (input naming, cycle policy).
- Status: fixed - `richText` + `includes` inputs; an embedded entry gets an injector carrying its ancestor entry ids, and a nested renderer skips an ancestor with a dev warning.

## HCF-07 `embedded-resource-*` nodes render nothing, while the warning and the docs say "rendered as div/span"

- Where: `rich-text-renderer.util.ts:47-50` (warning "Its content is rendered inside a <div>"),
  `rich-text-renderer.component.ts:854-863` (an element with no rendered children is pruned);
  `apps/docs/contentful/index.md:102-103`.
- Problem: `embedded-resource-block` / `embedded-resource-inline` (cross-space references) always have
  `content: []`, so the fallback element is pruned and nothing reaches the DOM - yet the dev warning and the docs
  table promise a `div`/`span`. A developer inspecting the DOM for the promised element finds nothing.
- Fix: for nodes without content, warn "is not supported and is skipped" (name the node and its
  `data.target.sys.urn`); update the docs table rows. Spec next to "renders an unsupported inline as a span".
- Breaking: no. Decision: no.
- Status: fixed - embedded resource nodes are skipped with a "not supported and is skipped" warning naming the urn; docs table updated.
