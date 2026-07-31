---
'@ethlete/components': minor
---

Bracket: the placeholder cards are now real — compact `et-match-card` cells, a hero final card with a
champion line, heading round headers (`roundHeaderLevel`) and a labelled continue cell. They need
`provideBracketConfig({ matchNormalizer })` to read your match data (`normalizeEthleteBracketMatch` ships
for Ethlete feeds), and `finalColumnWidth` / `finalMatchHeight` now default to `360` / `200` to fit them.
