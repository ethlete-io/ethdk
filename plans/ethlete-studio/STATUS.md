# Studio – Status

Stand: 01.11.2026, abends

## Ziel

Studio ist fertig (MVP), wenn jedes Studio-Teil im Code so aussieht wie sein gemergter Entwurf und keine offenen Punkte
mehr hat („fertig“). Die Abläufe selbst funktionieren schon. Chat, Flows und Inventar sind bis nach dem MVP
ausgeklammert.

## Teile

| Teil                            | Fertig | Was fehlt                                                                         | Wer               |
| ------------------------------- | ------ | --------------------------------------------------------------------------------- | ----------------- |
| components/comment-pin          | ✅     |                                                                                   |                   |
| components/disclosure           | ✅     |                                                                                   |                   |
| components/tree-row             | ✅     | Studio baut wieder; Live-Shot mit 13 px fehlt noch, dann neues „Go geben“         | Builder, dann Tom |
| components/zoom-chip            | ✅     |                                                                                   |                   |
| elements/part-tree              | ✅     |                                                                                   |                   |
| elements/studio-menu            | ✅     |                                                                                   |                   |
| components/shell-collapse       | ✅     |                                                                                   |                   |
| components/shell-project-switch | ❌     | Go gegeben, Prüfung läuft                                                         | Builder           |
| elements/shell-main             | ❌     | Go gegeben, Prüfung läuft                                                         | Builder           |
| pages/inbox                     | ❌     | Go gegeben, Prüfung läuft                                                         | Builder           |
| pages/system                    | ❌     | Merge-Ansicht leer, Builder repariert; dann mergen und „Go geben“                 | Builder, dann Tom |
| pages/sketches                  | ❌     | Hover-Rahmen raus aus Entwurf und App, dann Merge von pages-system und „Go geben“ | Builder, dann Tom |
| components/canvas-viewport      | ❌     | Code wird auf keiner Seite mehr benutzt, Marke entfernt                           | Builder           |
| elements/canvas-frames          | ❌     | App zeichnet ein Element, das der Entwurf nicht hat                               | Builder           |
| pages/start                     | ❌     | Knöpfe im Entwurf ergänzt, Prüfung noch nicht grün; danach „Go geben“             | Builder, dann Tom |
| pages/merge                     | ❌     | Merge-Ansicht zeigt Vorher/Nachher nicht; Prüfung noch nicht grün                 | Builder           |
| components/error-toast          | ❌     | Go gegeben, Prüfung läuft                                                         | Builder           |

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
- Zoom-Leiste wieder unten rechts, kein türkiser Rahmen mehr nach einem Klick in den Canvas (01.11.).
- Spalte „Aktuell“ im Sketch zeigt immer einen Rahmen (01.11.).
- Ausgewählter Rahmen in Sketches hat denselben Umriss wie in System; kein Rahmen mehr beim Hovern (01.11.).
- Knopf „2 offen“ bleibt nicht mehr gedrückt, wenn das Popup schließt (01.11.).

## Gerade in Arbeit

- Parallel: leere Merge-Ansicht, Knopf „Wählen“, Prüfungen für Start und Merge, Fehler-Toast.
- Shell-Teile (shell-main, shell-project-switch, pages/inbox): Prüfung wartet auf den Fix für eingebettete Teile.

## Für später gesammelt

- Teil-Baum verliert beim Neuladen die Scroll-Position (Befund 99).
- Canvas in Sketches und Flow ändert sich, wenn die Seitenleiste auf- oder zugeht (Befund 100).
