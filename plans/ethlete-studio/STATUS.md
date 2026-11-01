# Studio – Status

Stand: 01.11.2026, abends

## Ziel

Studio ist fertig (MVP), wenn jedes Studio-Teil im Code so aussieht wie sein gemergter Entwurf und keine offenen Punkte
mehr hat („fertig“). Die Abläufe selbst funktionieren schon. Chat, Flows und Inventar sind bis nach dem MVP
ausgeklammert.

## Teile

| Teil                            | Fertig | Was fehlt                                                                                                               | Wer               |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------- |
| components/comment-pin          | ✅     |                                                                                                                         |                   |
| components/disclosure           | ✅     |                                                                                                                         |                   |
| components/tree-row             | ✅     |                                                                                                                         |                   |
| components/zoom-chip            | ✅     |                                                                                                                         |                   |
| elements/part-tree              | ✅     |                                                                                                                         |                   |
| elements/studio-menu            | ✅     | Menü-Werte gelten bald für alle Studio-Menüs (Q130), dann neues „Go geben“                                              | Builder, dann Tom |
| components/shell-collapse       | ✅     |                                                                                                                         |                   |
| components/shell-project-switch | ❌     | Menü bekommt den Look des Studio-Menüs (Q130), dann neues „Go geben“                                                    | Builder, dann Tom |
| elements/shell-main             | ❌     | Go gegeben, Prüfung läuft                                                                                               | Builder           |
| pages/inbox                     | ❌     | Klick auf Kommentar öffnet seinen Ort (Q129, wird gebaut); dann neues „Go geben“                                        | Builder, dann Tom |
| pages/system                    | ❌     | Sketch gemergt; Prüfung läuft, dann „Go geben“                                                                          | Builder, dann Tom |
| pages/sketches                  | ❌     | „Wählen“ und Hover fertig, Vergleich 0 px; Prüfung der Aktionen noch nicht grün                                         | Builder, dann Tom |
| components/canvas-viewport      | ❌     | Code wird auf keiner Seite mehr benutzt, Marke entfernt                                                                 | Builder           |
| elements/canvas-frames          | ❌     | App zeichnet ein Element, das der Entwurf nicht hat                                                                     | Builder           |
| pages/start                     | ❌     | Knöpfe im Entwurf ergänzt, Prüfung noch nicht grün; danach „Go geben“                                                   | Builder, dann Tom |
| pages/merge                     | ❌     | Echter Ausschnitt statt Demo-Knopf (Befund 104), „Neu in a“, Ladezustand am Merge-Knopf (Q132); Prüfung noch nicht grün | Builder           |
| components/error-toast          | ❌     | Bereit: neues „Go geben“ (Schrift und Fläche repariert, Vergleich 0 px)                                                 | Tom               |

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

- Parallel: Canvas ändert sich beim Auf- und Zuklappen der Seitenleiste (Befund 100), Merge-Ansicht: Ausschnitt-Zeile und Text „Neu in a“ (Befund 104), ein Look für alle Menüs (Q130), Prüfungen für Start und Merge.
- Shell-Teile (shell-main, shell-project-switch, pages/inbox): Prüfung wartet auf den Fix für eingebettete Teile.

## Für später gesammelt

- Breite der Seitenleiste mit der Maus ziehen (Q133).

- Teil-Baum verliert beim Neuladen die Scroll-Position (Befund 99).
