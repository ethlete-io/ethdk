---
status: accepted
open: B475
decided: 2026-11-10
source: grill session 2026-11-10 (morning round), findings 687 and 688
---

# Agent sessions get TypeScript diagnostics from a language server

Two night slices went in with type errors in the files they edited, and no session saw them for hours. The
`typescript-lsp` Claude Code plugin is installed at user level (`~/.claude/settings.json`), not in the repo settings, so an agent gets the type errors of each edited file
right after the edit. It does not see a break in a file that nobody opens, so the push suite typecheck of ADR 0245
stays as the full check. The install gets a bite: a deliberate type error in an edited file shows up as a diagnostic.
Rejected: the plugin alone, and no plugin. The human asked: "Zu q3 sollte der ts lsp nicht eigentlich das schon liefern?
Aka wieso fragen wir nicht den lsp für angepasste Daten ab." and then answered "Q4ok".
On the install the human chose the user level: "ist auf user ebene".
