# Studio – Status

Stand: 01.11.2026, abends

## Ziel

Studio ist fertig (MVP), wenn jedes Studio-Teil im Code so aussieht wie sein gemergter Entwurf und keine offenen Punkte
mehr hat („fertig“). Die Abläufe selbst funktionieren schon. Chat, Flows und Inventar sind bis nach dem MVP
ausgeklammert.

## Teile

| Teil                            | Fertig | Was fehlt                                                           | Wer     |
| ------------------------------- | ------ | ------------------------------------------------------------------- | ------- |
| components/comment-pin          | ✅     |                                                                     |         |
| components/disclosure           | ✅     |                                                                     |         |
| components/tree-row             | ✅     |                                                                     |         |
| components/zoom-chip            | ✅     |                                                                     |         |
| elements/part-tree              | ✅     |                                                                     |         |
| elements/studio-menu            | ✅     |                                                                     |         |
| components/shell-collapse       | ❌     | Go gegeben, Prüfung läuft                                           | Builder |
| components/shell-project-switch | ❌     | Go gegeben, Prüfung läuft                                           | Builder |
| elements/shell-main             | ❌     | Go gegeben, Prüfung läuft                                           | Builder |
| pages/inbox                     | ❌     | Zoom-Leiste repariert, Entwurf geändert: neues „Go geben“           | Tom     |
| pages/system                    | ❌     | Zoom-Leiste repariert: neues „Go geben“, Sketch pages-system mergen | Tom     |
| pages/sketches                  | ❌     | Sketch pages-system mergen (gilt für beide Seiten)                  | Tom     |
| components/canvas-viewport      | ❌     | Code wird auf keiner Seite mehr benutzt, Marke entfernt             | Builder |
| elements/canvas-frames          | ❌     | App zeichnet ein Element, das der Entwurf nicht hat                 | Builder |
| pages/start                     | ❌     | 3 Knöpfe ohne Aktion im Entwurf                                     | Builder |
| pages/merge                     | ❌     | Kopfzeile in der App weicht vom Entwurf ab                          | Builder |
| components/error-toast          | ❌     | Kontrast und Schließen-Zustände im Entwurf, dann „Go geben“         | Builder |

Stand: 6 von 17 Teilen fertig. Alle Teile außer dem Fehler-Toast sind gemergt und im Code. „Go geben“ ist der Knopf
oben rechts in der Teil-Ansicht.

## Regeln, bis das Ziel steht

1. Gebaut wird nur, was ein Teil fertig macht. Neue Prozess-Werkzeuge kommen auf die Liste für später.
2. Jedes Ding gibt es nur einmal: ein Canvas, ein Picker, keine Kopien.
3. Jeder Fehler wird zuerst ein Test, dann wird er behoben.
4. Der Builder wartet nicht auf Tom. Tom schaut, wann er Zeit hat.
5. Tom bekommt eine kurze Runde, wenn er da ist: was jetzt geht, höchstens 3 Fragen.

## Erledigt

- Ein Canvas für System und Sketches (01.11.). Sketches verschiebt jetzt mit gedrückter linker Maustaste wie System.
- Zoom-Leiste wieder unten rechts, kein türkiser Rahmen mehr nach einem Klick in den Canvas (01.11.).
- Spalte „Aktuell“ im Sketch zeigt immer einen Rahmen (01.11.).

## Gerade in Arbeit

- Parallel: Umriss für den ausgewählten Rahmen in Sketches, Fehler-Toast, Start und Merge.
