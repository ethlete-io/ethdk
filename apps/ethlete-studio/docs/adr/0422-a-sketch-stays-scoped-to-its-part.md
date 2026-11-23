---
status: accepted
open: B686
decided: 2026-11-23
source: doc-agent session 2026-11-23, Q2 and Q5
---

# A sketch stays scoped to its question, and each of its parts can be seen

The tomflix designer put 7 targets into one sketch named colors (foundations colors, type, tokens, logo; elements
app-shell, hero, title-card). The sketch view draws only the first target. Asked whether the sketch view should draw
every target in its own block, the human answered: "das ist doch ein missuse der funktion. sonst wäre ja alles nicht in
colors scoped."

Later the human summed up: "wir wollen sketches haben die aus mehreren teilen bestehen können. nun haben wir das und
der designer agent misbraucht das für das komplette app design anstelle einzelne sketches zu machen. zudem haben wir sub
sketches effektiv nutzlos gemacht weil man sie nicht ansehen kann". The first-target limit was no decision: it came with
the rebuild of the sketches page (5a29b1b94). The human said "ok" to the fix below.

- A sketch with targets that do not belong to its question is a misuse. The design CLI stops the agent from building
  it, and the agent makes one sketch per part instead. ADR 0099 (round title in a multi-part head) stays for a real
  multi-part sketch.
- A click on a target row in the part tree shows that part's frames in the sketch view, in the same presentation as a
  one-part sketch. The view shows one part at a time, not every part in one long column.
- Removes: the "nicht in der Sketch-Ansicht" tooltip on target rows.
