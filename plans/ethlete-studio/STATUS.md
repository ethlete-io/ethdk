# Studio – Status

Stand: 01.11.2026, abends

## Ziel

Studio ist fertig (MVP), wenn jedes Studio-Teil im Code so aussieht wie sein gemergter Entwurf und keine offenen Punkte
mehr hat („fertig“). Die Abläufe selbst funktionieren schon. Chat, Flows und Inventar sind bis nach dem MVP
ausgeklammert.

## Teile

| Teil                            | Fertig | Was fehlt                                           | Wer               |
| ------------------------------- | ------ | --------------------------------------------------- | ----------------- |
| components/canvas-viewport      | ✅     |                                                     |                   |
| components/comment-pin          | ✅     |                                                     |                   |
| components/disclosure           | ✅     |                                                     |                   |
| components/tree-row             | ✅     |                                                     |                   |
| components/zoom-chip            | ✅     |                                                     |                   |
| elements/part-tree              | ✅     |                                                     |                   |
| elements/studio-menu            | ✅     |                                                     |                   |
| components/shell-collapse       | ❌     | Entwurf hat sich geändert, braucht neues „Go geben“ | Tom               |
| components/shell-project-switch | ❌     | Entwurf hat sich geändert, braucht neues „Go geben“ | Tom               |
| elements/shell-main             | ❌     | Entwurf hat sich geändert, braucht neues „Go geben“ | Tom               |
| pages/inbox                     | ❌     | Zoom-Leiste steht falsch, dann neues „Go geben“     | Builder, dann Tom |
| pages/sketches                  | ❌     | Fertiger Sketch ist noch nicht gemergt              | Tom               |
| pages/system                    | ❌     | Fertiger Sketch ist noch nicht gemergt              | Tom               |
| elements/canvas-frames          | ❌     | App zeichnet ein Element, das der Entwurf nicht hat | Builder           |
| pages/start                     | ❌     | 3 Knöpfe ohne Aktion im Entwurf                     | Builder           |
| pages/merge                     | ❌     | Kopfzeile in der App weicht vom Entwurf ab          | Builder           |
| components/error-toast          | ❌     | Neu, noch in Arbeit                                 | Builder           |

Stand: 7 von 17 Teilen fertig. Alle Teile außer dem Fehler-Toast sind gemergt und im Code. „Go geben“ ist der Knopf
oben rechts in der Teil-Ansicht.

## Regeln, bis das Ziel steht

1. Gebaut wird nur, was ein Teil fertig macht. Neue Prozess-Werkzeuge kommen auf die Liste für später.
2. Jedes Ding gibt es nur einmal: ein Canvas, ein Picker, keine Kopien.
3. Jeder Fehler wird zuerst ein Test, dann wird er behoben.
4. Der Builder wartet nicht auf Tom. Tom schaut, wann er Zeit hat.
5. Tom bekommt eine kurze Runde, wenn er da ist: was jetzt geht, höchstens 3 Fragen.

## Erledigt

- Ein Canvas für System und Sketches (01.11.). Sketches verschiebt jetzt mit gedrückter linker Maustaste wie System.

## Gerade in Arbeit

- Umriss für den ausgewählten Rahmen in Sketches, dann Fehler-Toast, dann Canvas-Rahmen, Start und Merge.
