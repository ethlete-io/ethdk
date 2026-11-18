---
status: accepted
built: 80480dce5
decided: 2026-10-22
source: plans/docs-examples.md (deleted in B597), approved by the human
---

# Docs examples are their own files, not Storybook hosts

A docs guide shows copyable code: each example is a standalone component file under
`apps/docs-examples/src/examples/<domain>/`, rendered live in the docs site and shown with its source through one
`@example <domain>/<name>` line. Storybook stays as it is and is not the example source.

An example imports only public `@ethlete/*` entry points, uses no Tailwind, no `et-sb-` selectors and no Storybook
wrapper markup, takes theme names from the examples app config, and is self-contained: a reader can paste it into an
app. All `components/`, `cdk/`, `query/`, `query-devtools/` and `contentful/` guides use it; `<StoryEmbed>` stays only for
a story with nothing to copy.
