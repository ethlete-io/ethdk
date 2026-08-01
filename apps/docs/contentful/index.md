# @ethlete/contentful

Angular components for rendering [Contentful](https://www.contentful.com/) content. The centerpiece is a rich-text renderer that turns a Contentful rich-text document into real DOM — including embedded assets and dynamically created Angular components for embedded entries. Around it sit ready-made asset components (image, video, audio, file, link), a config provider, and typed helpers for Contentful's REST and GraphQL APIs.

```bash
yarn add @ethlete/contentful
```

The package peers on `@ethlete/core`, `@ethlete/components`, `@ethlete/query` and `@contentful/rich-text-types`. Upgrading from v4? Run the codemod: `nx g @ethlete/contentful:migrate-to-contentful-v5` — it renames the changed image input, removes the dropped `useTailwindClasses` config option, adds the `@ethlete/components` dependency and writes `contentful-v5-migration-tasks.md` for anything it can't rewrite (removed image class inputs, removed renderer internals, a leftover `@ethlete/cdk` dependency).

## Setup

Register the (optional) config where you use the renderer — globally or on the consuming component. This is also where custom components for embedded entries are mapped:

```ts
import { ContentfulRichTextRendererComponent, provideContentfulConfig } from '@ethlete/contentful';

@Component({
  imports: [ContentfulRichTextRendererComponent],
  providers: [
    provideContentfulConfig({
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

All config options (defaults from `createContentfulConfig()`):

| Option                         | Default                                                         | Purpose                                                                                                    |
| ------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `components`                   | The built-in `ContentfulImage/Video/Audio/File/Link` components | Override how embedded assets and hyperlinks render.                                                        |
| `customComponents`             | `{}`                                                            | Map of Contentful content-type id → component for [embedded entries](#embedded-entries-custom-components). |
| `internalHosts`                | `[]`                                                            | Extra hostnames the [link component](#links) treats as internal (router navigation instead of `<a href>`). |
| `imageOptions.srcsetSizes`     | `['375w', '1280w', '1920w', '2560w']`                           | Default srcset candidates for [images](#images).                                                           |
| `imageOptions.sizes`           | `[]`                                                            | Default `sizes` attribute entries for images.                                                              |
| `imageOptions.backgroundColor` | `null`                                                          | Background color (`bg=rgb:…`) applied by the Contentful Images API.                                        |

::: warning Shallow merge
`provideContentfulConfig` spreads your partial over the defaults **shallowly** — passing `imageOptions` or `components` replaces the whole sub-object, so include every key you still want.
:::

If no config is provided, the renderer and link component fall back to the defaults above; only `ContentfulImageComponent` _requires_ the provider.

`ContentfulImports` bundles the audio, file, image, video and rich-text-renderer components for convenience (the link component is not included — import it separately if you use it directly).

## Rendering rich text

`<et-contentful-rich-text-renderer>` takes the **raw Contentful REST response** and a path to the rich-text field inside it:

| Input          | Type                                                   | Purpose                                                                                          |
| -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `content`      | `ContentfulCollection \| null \| undefined` (required) | The full collection response — `includes.Asset` / `includes.Entry` are needed to resolve embeds. |
| `richTextPath` | `string` (required)                                    | Dot/array path to the rich-text `document` field, e.g. `items[0].fields.html`.                   |

The component has an empty template and renders imperatively. Each node type maps to a plain HTML element:

| Node type                                               | Element                         |
| ------------------------------------------------------- | ------------------------------- |
| `heading-1` … `heading-6`                               | `h1` … `h6`                     |
| `paragraph`                                             | `p`                             |
| `unordered-list` / `ordered-list` / `list-item`         | `ul` / `ol` / `li`              |
| `blockquote`, `hr`                                      | `blockquote`, `hr`              |
| `table`, `table-row`, `table-cell`, `table-header-cell` | `table`, `tr`, `td`, `th`       |
| `hyperlink`, `entry-hyperlink`, `asset-hyperlink`       | `a` (see [Links](#links))       |
| `text`                                                  | `span` (newlines become `<br>`) |

Every element gets the classes `et-contentful-rich-text-default-element` and `et-contentful-rich-text-default-<tag>` for styling. Elements that end up empty are pruned (except `td` and `hr`).

When `content` changes, the renderer **diffs** the new document against the previous render. Unchanged plain elements and text spans keep their DOM nodes; only nodes whose output, position or ancestry actually changed are rebuilt. Embedded components are keyed by their entry (or asset) id: as long as the same entry stays in the document its component instance survives — even across reorders, where the instance moves with its entry. Surviving instances receive new inputs reactively (they are bound with `inputBinding`, so signal inputs update in place); a different entry taking a slot always gets a fresh instance. Setting an identical document performs no DOM writes at all.

### Text marks

Marks on text nodes are emitted as classes: `bold` → `font-bold`, `italic` → `italic`, `underline` → `underline`, `code` → `font-mono`. Unknown mark types fall back to the raw mark name as class (with a dev-mode warning). The names follow Tailwind conventions, but they're just classes — style them yourself if you don't use Tailwind.

## Embedded entries (custom components)

`embedded-entry-block` / `embedded-entry-inline` nodes are rendered by looking up the entry's content-type id in `config.customComponents`. No registered component throws [ET006](#error-codes). A custom component declares **any subset** of these inputs — only the ones it declares are set:

```ts
@Component({/* … */})
export class TeaserCollectionComponent {
  fields = input.required<TeaserCollectionFields>(); // the entry's fields
  sys = input.required<ContentfulEntrySys>();
  metadata = input<ContentfulMetadata>();
  includes = input.required<ContentfulIncludeMap>(); // resolve linked entries/assets
}
```

The `ContentfulIncludeMap` resolves links against the collection's `includes`:

- `getEntry<T>(id, contentTypeId)` / `getEntries<T>(ids, contentTypeId)` — pass `ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID` to match any content type. Missing or mismatched entries dev-warn and return `null` (or are omitted from the array).
- `getAsset(id)` / `getAssets(ids)`

The `isContentfulEntryType<T>(entry, type)` guard narrows an entry by its content-type id. To resolve links outside the renderer (e.g. in a page component working with the raw collection), build a map yourself with `createContentfulIncludeMap({ includes })`.

## Embedded assets

`embedded-asset-block` nodes pick a component by the asset's MIME type: `image/*` → `components.image`, `video/*` → `components.video`, `audio/*` → `components.audio`, anything else → `components.file`. Each receives the resolved asset as its `asset` input; all four accept both REST (`ContentfulRestAsset`) and GraphQL (`ContentfulGqlAsset`) asset shapes. You can use them standalone, too.

### Images

`<et-contentful-image>` renders an `et-picture` (from `@ethlete/components`) with sources generated through the [Contentful Images API](https://www.contentful.com/developers/docs/references/images-api/) — one `<source>` per format in the order avif, webp, png, jpg.

| Input              | Default                           | Purpose                                                                                      |
| ------------------ | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `asset` (required) | —                                 | REST or GQL asset. Alt text comes from the asset title, the figcaption from its description. |
| `srcsetSizes`      | config `imageOptions.srcsetSizes` | Srcset candidates: `'400'`/`'400w'` (width), `'400h'` (height), `'400x300'` (both).          |
| `sizes`            | config `imageOptions.sizes`       | `sizes` attribute entries.                                                                   |
| `quality`          | `null`                            | Contentful `q=` parameter.                                                                   |
| `focusArea`        | `null`                            | `f=` parameter (`'center'`, `'top_left'`, `'face'`, …).                                      |
| `resizeBehavior`   | `null`                            | `fit=` parameter (`'pad'`, `'crop'`, `'fill'`, `'scale'`, `'thumb'`, `'fit'`).               |
| `backgroundColor`  | `null`                            | `bg=rgb:…` parameter.                                                                        |
| `priority`         | `false`                           | Marks the image as high-priority (eager loading).                                            |

There are no class passthrough inputs — target the static `et-picture-figure`, `et-picture-picture`, `et-picture-img` and `et-picture-figcaption` classes with CSS instead.

The source-generation helpers (`generateContentfulImageSources`, `generateDefaultContentfulImageSource`, `parseContentfulImageSize`) are exported for custom image components.

### Video, audio, file

- `<et-contentful-video>` — native `<video controls>` with one `<source>`; `videoClass` input.
- `<et-contentful-audio>` — `<figure>` with the asset title as `<figcaption>` and a native `<audio controls>`; `audioClass`, `figureClass`, `figcaptionClass` inputs.
- `<et-contentful-file>` — a download link (`target="_blank"`) showing the file's title and size; `fileClass` input.

### Links

`<et-contentful-link>` (inputs: `href`, `text` required; `textClass` default `''`) renders hyperlink nodes and decides between router navigation and a plain anchor:

- A URL is **external** only if it's absolute (`http://`, `https://`, `//`) _and_ its host matches neither the current `document.location.host` nor any entry in `config.internalHosts` (compared by primary domain, so `'example.com'` also covers subdomains). External links to a different primary domain open in a new tab with `rel="noopener noreferrer"`.
- Internal links render `[routerLink]` with the URL reduced to path + query + hash — useful when content authored against the production domain runs on localhost or a preview host (add the production host to `internalHosts`).

## GraphQL helpers

For Contentful's GraphQL API the package exports:

- `GQL_FRAGMENT_CONTENTFUL_ASSET` — a `gql` fragment (`AssetData on Asset`) selecting everything `ContentfulGqlAsset` needs, ready to spread into queries built with [`@ethlete/query`](/query/gql).
- `isContentfulGqlAsset()` — type guard for the fragment's result.
- `ContentfulGqlCollectionFilterVariables<TCustomWhere, TLinkedFrom>` — typed `skip` / `limit` / `where` / `order` / `preview` / `locale` variables, with `ContentfulGqlWhereFilter` covering the common `sys` id and metadata-tag filters and `ContentfulGqlOrder` for `` `${field}_${'ASC' | 'DESC'}` `` sort keys.

REST-side types (`ContentfulCollection`, `ContentfulEntry<T>`, `ContentfulRestAsset`, `ContentfulEntrySys`, `ContentfulMetadata`, `RichTextResponse`, link types, …) are exported for annotating query responses.

## Error codes

The rich-text renderer throws `RuntimeError`s with renderer-local codes (`ET` + 3 digits — a separate namespace from the [`@ethlete/components` ranges](/components/error-codes)), all prefixed `<et-contentful-rich-text-renderer>:`.

| Code  | Thrown when                                                                     |
| ----- | ------------------------------------------------------------------------------- |
| ET000 | The value at `richTextPath` is undefined / not an object.                       |
| ET001 | The value is not a rich-text root (`nodeType: 'document'`).                     |
| ET002 | An embedded asset node has no asset id.                                         |
| ET003 | An embedded entry node has no entry id.                                         |
| ET004 | An embedded asset id isn't in `content.includes.Asset`.                         |
| ET005 | An embedded entry id isn't in `content.includes.Entry`.                         |
| ET006 | No `customComponents` entry is registered for an embedded entry's content type. |
| ET007 | A text node's parent node was not found.                                        |
| ET008 | A text node's parent is neither an HTML element nor a custom component.         |
