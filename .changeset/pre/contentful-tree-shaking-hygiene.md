---
'@ethlete/contentful': patch
---

Smaller bundles: the rich-text renderer no longer pulls the `@contentful/rich-text-types` runtime enums (~2.4 kB gz), and the renderer error codes plus `GQL_FRAGMENT_CONTENTFUL_ASSET` are now droppable literals. `@contentful/rich-text-types` stays a peer dependency for its types.
