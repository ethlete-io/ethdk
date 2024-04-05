---
'@ethlete/contentful': major
---

The `rich-text-renderer` component was rebuild from scratch.

- The `richText` input was renamed to `content` and is required.
- The value of the `content` input should be a `ContentfulCollection` object. This can be directly fetched using the Contentful REST API. Do not use their GraphQL API for this purpose.
- A `richTextPath` input was added to allow for the customization of the path to the `richText` field in the `ContentfulCollection` object. It is required and should point to the start of the rich text object inside the `ContentfulCollection` object. The start contains a `nodeType` property with the value `document`.
- All custom components now can contain the following input signals. They are optional and will be used by the renderer to expose the entry's data.
  - `fields` with your custom type defined inside Contentful.
  - `includes` with a type of `ContentfulIncludeMap`. Using this map you can access linked entries and assets.
  - `metadata` with a type of `ContentfulMetadata`
  - `sys` with a type of `ContentfulSys`
- Inside the `ContentfulAudioComponent`, `ContentfulFileComponent`, `ContentfulImageComponent`, and `ContentfulVideoComponent` components, the `data` input was renamed to `asset`.
- If you supply custom components for the ones mentioned above, they must also contain an `asset` signal with a type of `ContentfulAsset`.
- Everything evolving around the `RICH_TEXT_RENDERER_COMPONENT_DATA` DI token was removed. The renderer now sets and updates inputs instead of using dependency injection.
- The `GQL_FRAGMENT_CONTENTFUL_IMAGE` constant has been removed without replacement.
