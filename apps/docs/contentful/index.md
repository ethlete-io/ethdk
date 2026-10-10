# @ethlete/contentful

Angular components for rendering [Contentful](https://www.contentful.com/) content. The centerpiece is a rich-text renderer that turns a Contentful rich-text document into real DOM - including embedded assets and dynamically created Angular components for embedded entries. Around it sit ready-made asset components (image, video, audio, file, link), a config provider, and typed helpers for Contentful's REST and GraphQL APIs.

```bash
yarn add @ethlete/contentful
```

The package peers on `@ethlete/core`, `@ethlete/components`, `@ethlete/query` and `@contentful/rich-text-types`. Upgrading from 3.x to 4? Run the codemod: `nx g @ethlete/contentful:migrate-to-contentful-v5` (the generator name says v5, but it targets `@ethlete/contentful` 4) — it renames the changed image input, removes the dropped `useTailwindClasses` config option, adds the `@ethlete/components` dependency and writes `contentful-v5-migration-tasks.md` for anything it can't rewrite (removed image class inputs, removed renderer internals, a leftover `@ethlete/cdk` dependency).

## Setup

Register the (optional) config where you use the renderer - globally or on the consuming component. This is also where custom components for embedded entries are mapped:

```ts
import {
  ContentfulRichTextRendererComponent,
  provideContentfulConfig,
  CONTENTFUL_DEFAULT_COMPONENTS,
} from '@ethlete/contentful';

@Component({
  imports: [ContentfulRichTextRendererComponent],
  providers: [
    provideContentfulConfig({
      ...CONTENTFUL_DEFAULT_COMPONENTS,
      customComponents: {
        teaserCollection: TeaserCollectionComponent,
        newsElement: NewsElementComponent,
      },
    }),
  ],
  template: `<et-contentful-rich-text-renderer [content]="data()" richTextPath="items[0].fields.html" />`,
})
export class NewsArticleComponent {
  // data() is the raw Contentful REST response (ContentfulCollection)
}
```

## Live demo

<StoryEmbed id="contentful-rich-text--embedded-entries" height="520px" />

All config options (defaults from `createContentfulConfig()`):

| Option                         | Default                               | Purpose                                                                                                      |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `components`                   | `{}`                                  | Components for embedded assets and hyperlinks. Spread `CONTENTFUL_DEFAULT_COMPONENTS` for the built-in ones. |
| `customComponents`             | `{}`                                  | Map of Contentful content-type id → component for [embedded entries](#embedded-entries-custom-components).   |
| `internalHosts`                | `[]`                                  | Extra hosts the [link component](#links) treats as internal (router navigation instead of `<a href>`).       |
| `entryHref`                    | `null`                                | Turns the entry an `entry-hyperlink` points at into an href, see [Links](#links).                            |
| `imageOptions.srcsetSizes`     | `['375w', '1280w', '1920w', '2560w']` | Default srcset candidates for [images](#images).                                                             |
| `imageOptions.sizes`           | `['100vw']`                           | Default `sizes` attribute entries for images.                                                                |
| `imageOptions.backgroundColor` | `null`                                | Background color (`bg=rgb:…`) applied by the Contentful Images API.                                          |

::: tip Partial overrides
`imageOptions` merges one level deep (its type is partial, so `imageOptions: { sizes: ['50vw'] }` is enough), but a `components` key replaces the whole map, also one spread from `CONTENTFUL_DEFAULT_COMPONENTS` - to swap a single component, write `components: { ...CONTENTFUL_DEFAULT_COMPONENTS.components, image: MyImage }`. Other keys, such as `customComponents` and `internalHosts`, replace the default as a whole.
:::

::: warning The built-in components are opt-in
Spreading `CONTENTFUL_DEFAULT_COMPONENTS` registers `ContentfulImage/Video/Audio/File/Link` for embedded assets and hyperlinks. **Without the spread, and without your own `components`, the renderer ships no embedded components at all**: embedded assets are skipped (with a dev-mode warning) and hyperlinks render as plain `<a href>` anchors instead of `ContentfulLinkComponent`.

Leaving it out keeps the five components - and with them `PictureComponent` - out of the bundle, about 6.9 kB gz for an app that renders text only or brings its own components.

Upgrading from a version that registered them by default? `et update` runs the migration, or run it directly. It spreads `CONTENTFUL_DEFAULT_COMPONENTS` into every `provideContentfulConfig(...)` literal and lists the calls it could not edit in `contentful-default-components-migration-tasks.md`. An app that renders rich text without calling `provideContentfulConfig` at all gets a task there too, naming the file that renders it:

```bash
yarn nx g @ethlete/contentful:migrate-contentful-default-components
```

:::

Everything else falls back to the defaults above without the provider. The standalone image component uses the fallback image options, so it does not require `provideContentfulConfig()`.

`ContentfulImports` bundles the audio, file, image, video and rich-text-renderer components for convenience (the link component is not included - import it separately if you use it directly).

## Rendering rich text

`<et-contentful-rich-text-renderer>` takes the **raw Contentful REST response** and a path to the rich-text field inside it:

| Input          | Type                                         | Purpose                                                                                                     |
| -------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `content`      | `ContentfulCollection \| null \| undefined`  | The full collection response. `includes` may be omitted when there are no linked entities.                  |
| `richTextPath` | `string`                                     | Dot/array path to the rich-text `document` field, e.g. `items[0].fields.html`.                              |
| `gqlRichText`  | `ContentfulGqlRichText \| null \| undefined` | A GraphQL rich-text field, see [Rendering a GraphQL rich-text field](#rendering-a-graphql-rich-text-field). |
| `richText`     | `RichTextResponse \| null \| undefined`      | A bare rich-text document, see [Rich text inside an embedded entry](#rich-text-inside-an-embedded-entry).   |
| `includes`     | `ContentfulIncludeMap \| null \| undefined`  | The linked entries and assets `richText` resolves its embeds against.                                       |

Use `content` with `richTextPath`, `gqlRichText`, or `richText` with `includes` - one source only. In dev mode, setting more than one throws ET011.

An absent rich-text field renders nothing. In dev mode, a path whose parent does not resolve either (`item[0].fields.html`, or an `items[1]` the response does not have) also logs a warning naming the deepest part that resolved, since that is almost always a typo.

The component has an empty template and renders imperatively. Its host carries `ngSkipHydration`, so with `provideClientHydration()` the client discards the server-rendered rich text and renders it again instead of hydrating it.

Each node type maps to a plain HTML element:

| Node type                                               | Element                                    |
| ------------------------------------------------------- | ------------------------------------------ |
| `heading-1` … `heading-6`                               | `h1` … `h6`                                |
| `paragraph`                                             | `p`                                        |
| `unordered-list` / `ordered-list` / `list-item`         | `ul` / `ol` / `li`                         |
| `blockquote`, `hr`                                      | `blockquote`, `hr`                         |
| `table`, `table-row`, `table-cell`, `table-header-cell` | `table`, `tr`, `td`, `th`                  |
| `hyperlink`, `asset-hyperlink`                          | `a` (see [Links](#links))                  |
| `entry-hyperlink`                                       | `a` through `entryHref`, else text         |
| `text`                                                  | `span` (newlines become `<br>`)            |
| `embedded-resource-block`, `embedded-resource-inline`   | Nothing (skipped, with a dev-mode warning) |
| any other inline (e.g. `resource-hyperlink`)            | `span`, with a dev-mode warning            |
| any other block                                         | `div`, with a dev-mode warning             |

Every element gets the classes `et-contentful-rich-text-default-element` and `et-contentful-rich-text-default-<tag>` for styling. Elements that end up empty are pruned, except `td`, `th` and `hr`. Whitespace-only text nodes and every authored newline are preserved.

The list and table stories exercise nested structures and empty-cell-safe table output:

<StoryEmbed id="contentful-rich-text--lists" height="420px" />

<StoryEmbed id="contentful-rich-text--tables" height="420px" />

When `content` changes, the renderer **diffs** the new document against the previous render. Unchanged plain elements and text spans keep their DOM nodes; only nodes whose output, position or ancestry actually changed are rebuilt. Embedded components are keyed by their entry (or asset) id: as long as the same entry stays in the document its component instance survives — even across reorders, where the instance moves with its entry. Surviving instances receive new inputs reactively (they are bound with `inputBinding`, so signal inputs update in place); a different entry taking a slot always gets a fresh instance. Setting an identical document performs no DOM writes at all.

### Text marks

Marks on text nodes are rendered as nested semantic elements inside the text span, in mark order: `bold` → `<strong>`, `italic` → `<em>`, `underline` → `<u>`, `code` → `<code>`, `strikethrough` → `<s>`, `subscript` → `<sub>`, `superscript` → `<sup>`. Text with `bold` + `italic` therefore renders as `<span class="…"><strong><em>text</em></strong></span>`. Unknown mark types are ignored (with a dev-mode warning).

Marks inside a hyperlink rendered by the link component are the exception: it receives its text as a plain string, so the marks every text of the link shares are passed as mark types on its `marks` input and rendered as classes on the anchor - `et-contentful-rich-text-mark-<mark type>` (e.g. `et-contentful-rich-text-mark-bold`). Style those yourself. A mark on only part of the link text is dropped there; the fallback anchor keeps each text's own marks.

## Embedded entries (custom components)

`embedded-entry-block` / `embedded-entry-inline` nodes are rendered by looking up the entry's content-type id in `config.customComponents`. The entry is looked up in the collection's `items` and `includes.Entry` (the delivery API does not repeat an entry in `includes` when it is already one of the `items`; the `includes` copy wins on a duplicate). An entry with no registered component, or one missing from both (unpublished or deleted), is skipped with a dev-mode warning; the rest of the document still renders. A custom component declares **any subset** of these inputs - only the ones it declares are set:

```ts
@Component({/* … */})
export class TeaserCollectionComponent {
  fields = input.required<TeaserCollectionFields>(); // the entry's fields
  sys = input.required<ContentfulEntrySys>();
  metadata = input<ContentfulMetadata>();
  includes = input.required<ContentfulIncludeMap>(); // resolve linked entries/assets
}
```

The `ContentfulIncludeMap` resolves links against the collection's `items` and its optional `includes`:

- `getEntry<T>(id, contentTypeId)` / `getEntries<T>(ids, contentTypeId)` - pass `ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID` to match any content type. Missing or mismatched entries dev-warn and return `null` (or are omitted from the array).
- `getAsset(id)` / `getAssets(ids)`

The `isContentfulEntryType<T>(entry, type)` guard narrows an entry by its content-type id. To resolve links outside the renderer (e.g. in a page component working with the raw collection), build a map yourself with `createContentfulIncludeMap({ entries: [...content.items, ...(content.includes?.Entry ?? [])], assets: content.includes?.Asset ?? [] })`.

### Rich text inside an embedded entry

An embedded entry can carry its own rich-text field - a "Section" entry with a `body` that embeds images, say. Its custom component renders that field with a nested renderer: pass the document to `richText` and its own `includes` input on, so the nested embeds resolve against the same response:

```ts
@Component({
  selector: 'app-section',
  imports: [ContentfulRichTextRendererComponent],
  template: `<et-contentful-rich-text-renderer [richText]="fields().body" [includes]="includes()" />`,
})
export class SectionComponent {
  fields = input.required<{ body: RichTextResponse }>();
  includes = input.required<ContentfulIncludeMap>();
}
```

Entries that embed each other (A embeds B, B embeds A) do not recurse forever: a nested renderer skips an entry that is already one of its ancestors, with a dev-mode warning.

## Embedded assets

`embedded-asset-block` nodes pick a component by the asset's MIME type: `image/*` → `components.image`, `video/*` → `components.video`, `audio/*` → `components.audio`, anything else → `components.file`. A node whose component is not registered (no `CONTENTFUL_DEFAULT_COMPONENTS` spread and no own `components` entry for it) is skipped with a dev-mode warning, as is an asset missing from `includes` or one whose file has no URL yet. Each receives the resolved asset as its `asset` input; all four accept both REST (`ContentfulRestAsset`) and GraphQL (`ContentfulGqlAsset`) asset shapes. You can use them standalone, too.

### Images

`<et-contentful-image>` renders an `et-picture` (from `@ethlete/components`) with AVIF and WebP sources generated through the [Contentful Images API](https://www.contentful.com/developers/docs/references/images-api/). The original asset is the `<img>` fallback, so browsers that do not support either optimized format keep the asset's original MIME type instead of being forced to PNG.

| Input              | Default                               | Purpose                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset` (required) | —                                     | REST or GQL asset. Alt text comes from the asset title, the figcaption from its description.                                                                                                                                                                                                                          |
| `srcsetSizes`      | config `imageOptions.srcsetSizes`     | Srcset candidates: `'400'`/`'400w'` (width), `'400h'` (height), `'400x300'` (both). A height-only candidate uses the asset aspect ratio to emit a valid width descriptor and is omitted when dimensions are unavailable. In dev mode a dropped or unparseable candidate (`'50vw'` belongs in `sizes`) logs a warning. |
| `sizes`            | config `imageOptions.sizes`           | `sizes` attribute entries.                                                                                                                                                                                                                                                                                            |
| `quality`          | `null`                                | Contentful `q=` parameter.                                                                                                                                                                                                                                                                                            |
| `focusArea`        | `null`                                | `f=` parameter (`'center'`, `'top_left'`, `'face'`, …).                                                                                                                                                                                                                                                               |
| `resizeBehavior`   | `null`                                | `fit=` parameter (`'pad'`, `'crop'`, `'fill'`, `'scale'`, `'thumb'`, `'fit'`).                                                                                                                                                                                                                                        |
| `backgroundColor`  | config `imageOptions.backgroundColor` | `bg=rgb:…` parameter. A leading `#` is stripped.                                                                                                                                                                                                                                                                      |
| `priority`         | `false`                               | Marks the image as high-priority (eager loading).                                                                                                                                                                                                                                                                     |

There are no class passthrough inputs — target the static `et-picture-figure`, `et-picture-picture`, `et-picture-img` and `et-picture-figcaption` classes with CSS instead.

The source-generation helpers (`generateContentfulImageSources`, `generateDefaultContentfulImageSource`, `parseContentfulImageSize`) are exported for custom image components.

### Video, audio, file

- `<et-contentful-video>` - native `<video controls>` (`et-contentful-video-video`) with one `<source>` (`et-contentful-video-source`).
- `<et-contentful-audio>` - `<figure>` (`et-contentful-audio-figure`) with the asset title (or its file name) as `<figcaption>` (`et-contentful-audio-figcaption`), left out when the asset has neither, and a native `<audio controls>` (`et-contentful-audio-audio`).
- `<et-contentful-file>` - a download link (`et-contentful-file-anchor`, `target="_blank"`, `rel="noopener noreferrer"`) showing the file's title (or its file name when the title is empty) and size, scaled with `formatFileSize` from `@ethlete/components` (e.g. `(1.5 MB)`). Reword the size with `provideContentfulFileLabels`, the same label system every `@ethlete/components` domain uses:

```ts
provideContentfulFileLabels({ fileSize: (bytes) => `(${formatFileSize(bytes).replace('.', ',')})` });
```

There are no class inputs - target the static classes in parentheses with CSS instead. `et update` removes the old `videoClass`, `audioClass`, `figureClass`, `figcaptionClass` and `fileClass` bindings and lists each with the class that replaces it.

### Links

`<et-contentful-link>` (inputs: `href`, `text` required; `marks` default `[]`, `richText` default `false`) renders hyperlink nodes. Its anchor always carries the static class `et-contentful-link-anchor`; there are no class inputs. The renderer sets `richText` to `true`, which adds the rich-text classes (`et-contentful-rich-text-default-element et-contentful-rich-text-default-a`), so a standalone link carries none of them. A custom `components.link` receives `marks` and `richText` if it declares them. `et update` removes the old `textClass` and `anchorClass` bindings.

The link decides between router navigation and a plain anchor:

- Application paths and absolute HTTP(S) URLs whose host matches the current page exactly (hostname and port) or a configured `internalHosts` entry use `[routerLink]`. An `internalHosts` entry matches its host exactly, so `example.com` does not cover `shop.example.com` - list the subdomain, or write `*.example.com` to match every subdomain (but not `example.com` itself). An entry with a port (`cms.test:8080`) also requires that port.
- Native destinations such as `mailto:`, `tel:` and `ftp:` use a plain `<a href>`. External HTTP(S) links open in a new tab with `rel="noopener noreferrer"`.
- A fragment-only link (`#comments`) is a plain `<a>` whose `href` is the current page plus the fragment (`/news/article-1#comments`, prefixed with the `<base href>`), so it scrolls on the page instead of resolving against the base URL.
- Paths that do not start with `/` (`?page=2`, `./next`, `../list`) resolve against the current router URL, like a browser resolves them against the page, and follow later navigations.
- Without a `components.link` in the config, the renderer falls back to a plain anchor, which opens external HTTP(S) links in a new tab the same way and resolves `#fragment`, `?query` and `./relative` hrefs against the current router URL (prefixed with the `<base href>`). An internal absolute URL points at its path in this app (prefixed with the `<base href>`), the same place the link component routes to. Unsafe URL schemes are rendered as text without an `href`.
- Internal absolute URLs are reduced to path + query + hash and passed as an Angular `UrlTree`, so content authored against the production domain works on localhost or a preview host without encoding the query or fragment.
- Asset hyperlinks resolve to the included asset URL.
- Entry hyperlinks have no generic URL, so they render their label as text unless the config sets `entryHref`. It receives the linked entry and returns an href (or `null` for text), which then renders like a `hyperlink` - through the link component or the fallback anchor:

```ts
provideContentfulConfig({
  ...CONTENTFUL_DEFAULT_COMPONENTS,
  entryHref: (entry) => (entry.sys.contentType.sys.id === 'page' ? `/${entry.fields['slug']}` : null),
});
```

With GraphQL, select the fields `entryHref` reads under `links.entries.hyperlink`.

## GraphQL helpers

For Contentful's GraphQL API the package exports:

- `GQL_FRAGMENT_CONTENTFUL_ASSET` - a `gql` fragment (`ContentfulAssetData on Asset`) selecting everything `ContentfulGqlAsset` needs, ready to spread into queries built with [`@ethlete/query`](/query/gql).
- `isContentfulGqlAsset()` - type guard for the fragment's result.
- `ContentfulGqlCollectionFilterVariables<TCustomWhere, TLinkedFrom>` - typed `skip` / `limit` / `where` / `order` / `preview` / `locale` variables, with `ContentfulGqlWhereFilter` covering the common `sys` id and metadata-tag filters and `ContentfulGqlOrder` for `` `${field}_${'ASC' | 'DESC'}` `` sort keys.

REST-side types (`ContentfulCollection`, `ContentfulEntry<T>`, `ContentfulRestAsset`, `ContentfulEntrySys`, `ContentfulMetadata`, `RichTextResponse`, link types, …) are exported for annotating query responses.

### Rendering a GraphQL rich-text field

A rich-text field from the GraphQL API has the shape `{ json, links }`. Pass it to `gqlRichText` as-is; no REST-shaped collection has to be built by hand:

```ts
@Component({
  template: `<et-contentful-rich-text-renderer [gqlRichText]="page().body" />`,
  imports: [ContentfulRichTextRendererComponent],
})
export class PageComponent {
  page = input.required<{ body: ContentfulGqlRichText }>();
}
```

```graphql
body {
  json
  links {
    assets {
      block { sys { id } title url contentType width height size }
    }
    entries {
      block { __typename sys { id } }
      inline { __typename sys { id } }
    }
  }
}
```

`links.assets.block`, `links.assets.hyperlink`, `links.entries.block`, `links.entries.inline` and `links.entries.hyperlink` are all read. Embedded entries are matched to `customComponents` by the `__typename`: the key whose GraphQL type name equals it wins. Contentful derives the type name by PascalCasing the content type id and dropping separators, so `product-teaser`, `product_teaser` and `productTeaser` all match `ProductTeaser`. Without a matching key, the content type id is the `__typename` with its first letter lower-cased. Select `__typename` on every linked entry; one without it is skipped. The custom component receives the entry's selected fields (everything except `__typename` and `sys`) as `fields`.

## Error codes

The rich-text renderer throws `RuntimeError`s with renderer-local codes (`ET` + 3 digits - a separate namespace from the [`@ethlete/components` ranges](/components/error-codes)), all prefixed `<et-contentful-rich-text-renderer>:`.

| Code  | Thrown when                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| ET000 | The value at `richTextPath` exists but is not an object; the message names its type.                        |
| ET001 | The value is not a rich-text root (`nodeType: 'document'`).                                                 |
| ET002 | An embedded asset node has no asset id.                                                                     |
| ET003 | An embedded entry node has no entry id.                                                                     |
| ET007 | A text node's parent node was not found.                                                                    |
| ET009 | An internal render update found no rendered node for its command.                                           |
| ET010 | An internal render update expected a component but found a plain node.                                      |
| ET011 | More than one rich-text source is set: `gqlRichText`, `content`/`richTextPath`, `richText` (dev mode only). |
