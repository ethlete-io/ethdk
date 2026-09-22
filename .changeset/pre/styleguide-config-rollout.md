---
'@ethlete/core': patch
'@ethlete/query': patch
'@ethlete/contentful': patch
'@ethlete/types': patch
---

Adopt the `@ethlete/eslint-plugin` styleguide flat configs in `core`, `query`, `contentful` and
`types`, and apply the resulting auto-fixes. Runtime behavior is unchanged; three fixes are visible to
TypeScript consumers: exported `types` shapes are `type` aliases rather than `interface` declarations
(so they can no longer be extended by declaration merging), `core`'s `PropsDirective.destroyRef` and
`SeoDirective.parent` are `private`, and `ConsentHandler` is a `type`. The theme name registries stay
interfaces so consumers can keep augmenting them.
