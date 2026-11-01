# Studio – Status

Stand: 01.11.2026, spät abends

## Ziel

Studio ist fertig (MVP), wenn jedes Studio-Teil im Code so aussieht wie sein gemergter Entwurf und keine offenen Punkte
mehr hat („fertig“). Die Abläufe selbst funktionieren schon. Chat, Flows und Inventar sind bis nach dem MVP
ausgeklammert.

## Teile

| Teil                            | Fertig | Was fehlt                                                                                                                                                  | Wer               |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| components/comment-pin          | ✅     |                                                                                                                                                            |                   |
| components/disclosure           | ✅     |                                                                                                                                                            |                   |
| components/tree-row             | ✅     |                                                                                                                                                            |                   |
| components/zoom-chip            | ✅     |                                                                                                                                                            |                   |
| elements/part-tree              | ✅     |                                                                                                                                                            |                   |
| elements/studio-menu            | ✅     |                                                                                                                                                            |                   |
| components/shell-collapse       | ✅     |                                                                                                                                                            |                   |
| components/shell-project-switch | ✅     |                                                                                                                                                            |                   |
| elements/shell-main             | ✅     |                                                                                                                                                            |                   |
| pages/inbox                     | ❌     | Go gilt. „ready“ meldet 20 Aktions-Fehler (Canvas nicht fokussierbar, Schalter „Erledigte zeigen“ reagiert nicht auf Enter); Builder behebt beide          | Builder           |
| pages/system                    | ❌     | „fit“ liegt jetzt rechts neben dem Panel, Bild geprüft. Builder setzt noch Aktions-Marken ohne sichtbare Änderung; dann „Änderung abnehmen“ und „Go geben“ | Builder, dann Tom |
| pages/sketches                  | ✅     |                                                                                                                                                            |                   |
| components/canvas-viewport      | ✅     |                                                                                                                                                            |                   |
| elements/canvas-frames          | ✅     |                                                                                                                                                            |                   |
| pages/start                     | ✅     |                                                                                                                                                            |                   |
| pages/merge                     | ✅     |                                                                                                                                                            |                   |
| components/error-toast          | ✅     |                                                                                                                                                            |                   |

Stand: 15 von 17 Teilen fertig. Alle Teile außer dem Fehler-Toast sind gemergt und im Code. „Go geben“ ist der Knopf
oben rechts in der Teil-Ansicht.

## Regeln, bis das Ziel steht

1. Gebaut wird nur, was ein Teil fertig macht. Neue Prozess-Werkzeuge kommen auf die Liste für später.
2. Jedes Ding gibt es nur einmal: ein Canvas, ein Picker, keine Kopien.
3. Jeder Fehler wird zuerst ein Test, dann wird er behoben.
4. Der Builder wartet nicht auf Tom. Tom schaut, wann er Zeit hat.
5. Tom bekommt eine kurze Runde, wenn er da ist: was jetzt geht, höchstens 3 Fragen.

## Erledigt

- Schnellere Design-CLI: Aktions-Prüfungen laufen parallel, shell-main jetzt 80 s statt 322 s (Q16, 02.11.).

- Ein Canvas für System und Sketches (01.11.). Sketches verschiebt jetzt mit gedrückter linker Maustaste wie System.
- Zoom-Leiste wieder unten rechts, kein türkiser Rahmen mehr nach einem Klick in den Canvas (01.11.).
- Spalte „Aktuell“ im Sketch zeigt immer einen Rahmen (01.11.).
- Ausgewählter Rahmen in Sketches hat denselben Umriss wie in System; kein Rahmen mehr beim Hovern (01.11.).
- Knopf „2 offen“ bleibt nicht mehr gedrückt, wenn das Popup schließt (01.11.).

## Gerade in Arbeit

- Go erst, wenn alle Prüfungen grün sind (Q14). Änderungen ohne sichtbaren Unterschied machen ein Go nicht mehr ungültig (Q15, fertig 02.11.).

- Ein Knopf „Abnehmen und Go“, wenn beide Schritte offen sind (Q12, 01.11.).

- Parallel: Merge-Ansicht: Ausschnitt-Zeile und Text „Neu in a“ (Befund 104), ein Look für alle Menüs (Q130), Prüfungen für Start und Merge.
- Shell-Teile (shell-main, shell-project-switch, pages/inbox): Fehler im Werkzeug bei shell-main werden behoben (Befund 115).
- comment-pin bekommt einen neuen Zustand (erledigt, blass mit Haken). Danach brauchen comment-pin und pages/inbox je ein neues „Go geben“.
- pages/system: Prüfung läuft, Live-Shot folgt. pages/sketches: Kamera (Q135) wird gebaut.

## Für später gesammelt

- Harness-App nicht bei jedem Befehl neu bauen, spart etwa 11 s pro Lauf (Q16, 02.11.).

- Merge-Ansicht hat keinen Canvas mehr, kein Zoomen (Befund 117, 01.11.).

- Tooltips aus ethlete/components statt der nativen `title`-Tooltips (Befund 116, 01.11.).

- Seitenleiste: Repo-Wechsel und „Projekt öffnen“ ins Logo-Menü; oben im Kopf die Auswahl der Design-Systeme; schnelle Auswahl unten zeigt Logo oder zwei Buchstaben (01.11.).

- „Go geben“ und „Änderung abnehmen“ nebeneinander verwirren (Befund 109), mit der Überarbeitung von Go.
- Eigene Titelleiste mit Suche in der Mitte (Strg+K öffnet die Command Palette) und Knopf „Update“, wenn ein Update bereit ist. Arbeit (Rendern, Mergen) zeigt Studio nur in der Ansicht, auf die man wartet (01.11.).

- Breite der Seitenleiste mit der Maus ziehen (Q133).

- Teil-Baum verliert beim Neuladen die Scroll-Position (Befund 99).
