---
'@ethlete/core': patch
'@ethlete/query': patch
'@ethlete/contentful': patch
'@ethlete/types': patch
---

Adopt the `@ethlete/eslint-plugin` styleguide flat configs in `core`, `query`,
`contentful` and `types`, and apply the resulting auto-fixes.

The fixes are mechanical, but a few are visible to TypeScript consumers:

- `types`: exported API shapes are now `type` aliases instead of `interface`
  declarations, so they can no longer be extended via declaration merging.
- `core`: `PropsDirective.destroyRef` and `SeoDirective.parent` are now `private`,
  and `ConsentHandler` is a `type` alias.
- `contentful`: the image component's internal `_sources` / `_defaultSrc` template
  members were renamed to `sourcesValue` / `defaultSrcValue`.

Runtime behavior is unchanged. The theme name registries
(`EthleteColorThemeNameRegistry`, `EthleteSurfaceThemeNameRegistry`) deliberately
remain interfaces so consumers can keep augmenting them.
