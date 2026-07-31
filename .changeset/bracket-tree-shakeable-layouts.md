---
'@ethlete/components': major
---

Bracket: layouts are opt-in values you register, so an app bundles only the renderers it draws with.
Pass factories to `provideBracketConfig({ layouts })` or the `layouts` input on either host. The
`layout` input and `BracketConfig.swiss` are gone — mirrored is a layout, swiss options live on
`swissBracketLayout()` — and an unregistered mode throws `ET3413`.

```diff
- provideBracketConfig({ swiss: { colors } });
- <et-bracket layout="mirrored" [source]="source()" />
+ provideBracketConfig({ layouts: [mirroredSingleEliminationBracketLayout(), swissBracketLayout({ colors })] });
+ <et-bracket [source]="source()" />
```
