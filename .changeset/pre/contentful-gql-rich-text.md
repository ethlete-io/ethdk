---
'@ethlete/contentful': minor
---

Add a `[gqlRichText]` input to the rich-text renderer that takes a GraphQL rich-text field (`{ json, links }`) as-is, with the exported `ContentfulGqlRichText` type. `content` and `richTextPath` are now optional; setting `gqlRichText` together with either throws ET011 in dev mode.
