---
'@ethlete/contentful': major
---

- **Breaking:** an `internalHosts` entry now matches its host exactly; list a subdomain or write `*.example.com`.
- New `entryHref` config option turns entry hyperlinks into links, and new `richText` / `includes` inputs render an embedded entry's own rich text.
- Fix embeds of collection items, GraphQL content type ids with `-` or `_`, embedded resources and SSR hydration.
