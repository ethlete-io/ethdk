---
status: accepted
open: B685
decided: 2026-11-23
source: doc-agent session 2026-11-23, after Q1
---

# Design CLI texts stand alone

Check findings in a consumer repo end in "(ADR 0330)". The human: "adrs und co können aber nicht in die texte rein.
sonst bräuchte man ja den sdk checkout. das tool muss standalone funktionieren. das vergisst du leider noch andauernd."

- A text of the design CLI or of Studio (finding, usage line, hint, brief) names no ADR, plan row or SDK repo path. It
  says the rule itself, so a repo without the SDK checkout can act on it.
- A spec over the CLI texts fails on such a reference, so the slip cannot come back. It replaces the review by hand
  that missed it again and again.
