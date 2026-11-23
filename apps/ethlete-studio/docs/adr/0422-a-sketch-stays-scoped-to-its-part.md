---
status: accepted
open: B686
decided: 2026-11-23
source: doc-agent session 2026-11-23, Q2
---

# A sketch stays scoped to its part

The tomflix designer put 7 targets into one sketch named colors (foundations colors, type, tokens, logo; elements
app-shell, hero, title-card). The sketch view draws only the first target. Asked whether the sketch view should draw
every target in its own block, the human answered: "das ist doch ein missuse der funktion. sonst wäre ja alles nicht in
colors scoped."

- The sketch view keeps one sketch on its scope. It does not grow a block per target.
- A sketch with targets that do not belong to its question is a misuse. The design CLI stops the agent from building
  it, and the agent makes one sketch per part instead. ADR 0099 (round title in a multi-part head) stays for a real
  multi-part sketch.
