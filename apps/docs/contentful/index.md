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
| `internalHosts`                | `[]`                                  | Extra hostnames the [link component](#links) treats as internal (router navigation instead of `<a href>`).   |
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

| Input          | Type                                                   | Purpose                                                                                    |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `content`      | `ContentfulCollection \| null \| undefined` (required) | The full collection response. `includes` may be omitted when there are no linked entities. |
| `richTextPath` | `string` (required)                                    | Dot/array path to the rich-text `document` field, e.g. `items[0].fields.html`.             |

An absent rich-text field renders nothing. In dev mode, a path whose parent does not resolve either (`item[0].fields.html`, or an `items[1]` the response does not have) also logs a warning naming the deepest part that resolved, since that is almost always a typo.

The component has an empty template and renders imperatively. Each node type maps to a plain HTML element:

| Node type                                               | Element                         |
| ------------------------------------------------------- | ------------------------------- |
| `heading-1` … `heading-6`                               | `h1` … `h6`                     |
| `paragraph`                                             | `p`                             |
| `unordered-list` / `ordered-list` / `list-item`         | `ul` / `ol` / `li`              |
| `blockquote`, `hr`                                      | `blockquote`, `hr`              |
| `table`, `table-row`, `table-cell`, `table-header-cell` | `table`, `tr`, `td`, `th`       |
| `hyperlink`, `asset-hyperlink`                          | `a` (see [Links](#links))       |
| `entry-hyperlink`                                       | Text (no generic route exists)  |
| `text`                                                  | `span` (newlines become `<br>`) |
| any other inline (e.g. `resource-hyperlink`)            | `span`, with a dev-mode warning |
| any other block (e.g. `embedded-resource-block`)        | `div`, with a dev-mode warning  |

Every element gets the classes `et-contentful-rich-text-default-element` and `et-contentful-rich-text-default-<tag>` for styling. Elements that end up empty are pruned, except `td`, `th` and `hr`. Whitespace-only text nodes and every authored newline are preserved.

The list and table stories exercise nested structures and empty-cell-safe table output:

<StoryEmbed id="contentful-rich-text--lists" height="420px" />

<StoryEmbed id="contentful-rich-text--tables" height="420px" />

When `content` changes, the renderer **diffs** the new document against the previous render. Unchanged plain elements and text spans keep their DOM nodes; only nodes whose output, position or ancestry actually changed are rebuilt. Embedded components are keyed by their entry (or asset) id: as long as the same entry stays in the document its component instance survives — even across reorders, where the instance moves with its entry. Surviving instances receive new inputs reactively (they are bound with `inputBinding`, so signal inputs update in place); a different entry taking a slot always gets a fresh instance. Setting an identical document performs no DOM writes at all.

### Text marks

Marks on text nodes are rendered as nested semantic elements inside the text span, in mark order: `bold` → `<strong>`, `italic` → `<em>`, `underline` → `<u>`, `code` → `<code>`, `strikethrough` → `<s>`, `subscript` → `<sub>`, `superscript` → `<sup>`. Text with `bold` + `italic` therefore renders as `<span class="…"><strong><em>text</em></strong></span>`. Unknown mark types are ignored (with a dev-mode warning).

Marks inside a hyperlink rendered by the link component are the exception: it receives its text as a plain string, so the marks every text of the link shares are passed as classes on its `textClass` input - `et-contentful-rich-text-mark-<mark type>` (e.g. `et-contentful-rich-text-mark-bold`). Style those yourself. A mark on only part of the link text is dropped there; the fallback anchor keeps each text's own marks.

## Embedded entries (custom components)

`embedded-entry-block` / `embedded-entry-inline` nodes are rendered by looking up the entry's content-type id in `config.customComponents`. An entry with no registered component, or one missing from `includes` (unpublished or deleted), is skipped with a dev-mode warning; the rest of the document still renders. A custom component declares **any subset** of these inputs - only the ones it declares are set:

```ts
@Component({/* … */})
export class TeaserCollectionComponent {
  fields = input.required<TeaserCollectionFields>(); // the entry's fields
  sys = input.required<ContentfulEntrySys>();
  metadata = input<ContentfulMetadata>();
  includes = input.required<ContentfulIncludeMap>(); // resolve linked entries/assets
}
```

The `ContentfulIncludeMap` resolves links against the collection's optional `includes`:

- `getEntry<T>(id, contentTypeId)` / `getEntries<T>(ids, contentTypeId)` - pass `ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID` to match any content type. Missing or mismatched entries dev-warn and return `null` (or are omitted from the array).
- `getAsset(id)` / `getAssets(ids)`

The `isContentfulEntryType<T>(entry, type)` guard narrows an entry by its content-type id. To resolve links outside the renderer (e.g. in a page component working with the raw collection), build a map yourself with `createContentfulIncludeMap({ entries: content.includes?.Entry ?? [], assets: content.includes?.Asset ?? [] })`.

## Embedded assets

`embedded-asset-block` nodes pick a component by the asset's MIME type: `image/*` → `components.image`, `video/*` → `components.video`, `audio/*` → `components.audio`, anything else → `components.file`. A node whose component is not registered (no `CONTENTFUL_DEFAULT_COMPONENTS` spread and no own `components` entry for it) is skipped with a dev-mode warning, as is an asset missing from `includes`. Each receives the resolved asset as its `asset` input; all four accept both REST (`ContentfulRestAsset`) and GraphQL (`ContentfulGqlAsset`) asset shapes. You can use them standalone, too.

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

- `<et-contentful-video>` - native `<video controls>` with one `<source>`; `videoClass` input.
- `<et-contentful-audio>` - `<figure>` with the asset title (or its file name) as `<figcaption>` and a native `<audio controls>`; `audioClass`, `figureClass`, `figcaptionClass` inputs.
- `<et-contentful-file>` - a download link (`target="_blank"`, `rel="noopener noreferrer"`) showing the file's title (or its file name when the title is empty) and size, scaled with `formatFileSize` from `@ethlete/components` (e.g. `(1.5 MB)`); `fileClass` input. Reword the size with `provideContentfulFileLabels`, the same label system every `@ethlete/components` domain uses:

```ts
provideContentfulFileLabels({ fileSize: (bytes) => `(${formatFileSize(bytes).replace('.', ',')})` });
```

### Links

`<et-contentful-link>` (inputs: `href`, `text` required; `textClass` and `anchorClass` default `''`, both placed on the anchor) renders hyperlink nodes and decides between router navigation and a plain anchor. The renderer passes the rich-text classes (`et-contentful-rich-text-default-element et-contentful-rich-text-default-a`) through `anchorClass`, so a standalone link carries none of them; a custom `components.link` receives them too if it declares an `anchorClass` input:

- Application paths and absolute HTTP(S) URLs whose host matches the current page exactly (hostname and port) or a configured `internalHosts` entry use `[routerLink]`. Only a configured hostname covers its subdomains, but never unrelated hosts that merely share a public suffix.
- Native destinations such as `mailto:`, `tel:` and `ftp:` use a plain `<a href>`. External HTTP(S) links open in a new tab with `rel="noopener noreferrer"`.
- A fragment-only link (`#comments`) is a plain `<a>` whose `href` is the current page plus the fragment (`/news/article-1#comments`, prefixed with the `<base href>`), so it scrolls on the page instead of resolving against the base URL.
- Paths that do not start with `/` (`?page=2`, `./next`, `../list`) resolve against the current router URL, like a browser resolves them against the page, and follow later navigations.
- Without a `components.link` in the config, the renderer falls back to a plain anchor, which opens external HTTP(S) links in a new tab the same way and resolves `#fragment`, `?query` and `./relative` hrefs against the current router URL (prefixed with the `<base href>`). Unsafe URL schemes are rendered as text without an `href`.
- Internal absolute URLs are reduced to path + query + hash and passed as an Angular `UrlTree`, so content authored against the production domain works on localhost or a preview host without encoding the query or fragment.
- Asset hyperlinks resolve to the included asset URL. Entry hyperlinks render their label as text because Contentful entries have no generic URL; render entry links through a custom embedded-entry component when the content model defines routing.

## GraphQL helpers

For Contentful's GraphQL API the package exports:

- `GQL_FRAGMENT_CONTENTFUL_ASSET` - a `gql` fragment (`ContentfulAssetData on Asset`) selecting everything `ContentfulGqlAsset` needs, ready to spread into queries built with [`@ethlete/query`](/query/gql).
- `isContentfulGqlAsset()` - type guard for the fragment's result.
- `ContentfulGqlCollectionFilterVariables<TCustomWhere, TLinkedFrom>` - typed `skip` / `limit` / `where` / `order` / `preview` / `locale` variables, with `ContentfulGqlWhereFilter` covering the common `sys` id and metadata-tag filters and `ContentfulGqlOrder` for `` `${field}_${'ASC' | 'DESC'}` `` sort keys.

REST-side types (`ContentfulCollection`, `ContentfulEntry<T>`, `ContentfulRestAsset`, `ContentfulEntrySys`, `ContentfulMetadata`, `RichTextResponse`, link types, …) are exported for annotating query responses.

## Error codes

The rich-text renderer throws `RuntimeError`s with renderer-local codes (`ET` + 3 digits - a separate namespace from the [`@ethlete/components` ranges](/components/error-codes)), all prefixed `<et-contentful-rich-text-renderer>:`.

| Code  | Thrown when                                                                          |
| ----- | ------------------------------------------------------------------------------------ |
| ET000 | The value at `richTextPath` exists but is not an object; the message names its type. |
| ET001 | The value is not a rich-text root (`nodeType: 'document'`).                          |
| ET002 | An embedded asset node has no asset id.                                              |
| ET003 | An embedded entry node has no entry id.                                              |
| ET007 | A text node's parent node was not found.                                             |
| ET009 | An internal render update found no rendered node for its command.                    |
| ET010 | An internal render update expected a component but found a plain node.               |
