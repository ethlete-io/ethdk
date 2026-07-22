---
'@ethlete/components': minor
---

Bracket: new `<et-bracket>` tournament renderer — single/double-elimination and swiss layouts, SVG connectors, journey highlighting, and the `generateBracketDataForEthlete` data-source integration. Round-header, match, and continue cards render via barebones default components for now; supply custom cards through the `roundHeaderComponent` / `matchComponent` / `finalMatchComponent` / `continueComponent` inputs or `provideBracketConfig`.

This is the `@ethlete/cdk` `NewBracket` renderer moved here and renamed (`et-new-bracket` → `et-bracket`, `NewBracket*` → `Bracket*`), with colors now driven by the `--et-bracket-line-color` / `--et-bracket-swiss-group-border-color` tokens (default `--et-surface-border-solid`) and errors thrown as `RuntimeError` (ET34xx). The fifa.gg integration was not ported. See the guide's "Migrating from @ethlete/cdk" section.
