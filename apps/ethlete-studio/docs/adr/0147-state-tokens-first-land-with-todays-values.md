---
status: accepted
built: 31c882a86
decided: 2026-10-30
source: plans/ethlete-studio/design-system-actions/decisions.md, "State token values decisions", step A
---

# State tokens first land with today's values

No visible change: active = base colour, disabled = base at 0.4 opacity, on-colour disabled = 0.6, `--text-subtle` =
`--text-muted`; `generate-studio-themes.mjs` reads them from the part (`b39d636d4`, output byte-identical).
