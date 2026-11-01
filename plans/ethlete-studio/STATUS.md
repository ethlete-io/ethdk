# Studio – Status (Stand: 01.11.2026, spät)

## Ziel (MVP)

Jeder Studio-Teil ist **gemerged** (Design steht) und **ready** (Code passt zum Design, keine offenen Punkte).
Chat ist nicht im MVP.

## Wo wir stehen

| Was                   | Stand                                  |
| --------------------- | -------------------------------------- |
| Studio-Teile gesamt   | 19 (8 Components, 4 Elements, 7 Pages) |
| Design gemerged       | 18 von 19 – nur error-toast fehlt      |
| Ready (fertig)        | 1 von 19 – nur studio-menu             |
| Offene Fragen an dich | keine                                  |

Kurz: Das Design ist fast komplett. Die Umsetzung im Code ist fast nirgends abgenommen.

## Was gerade nicht gut läuft

- Der Canvas in „Sketches“ verhält sich anders als in „System“: Es gibt zwei Canvas-Umsetzungen statt einer.
- Du kannst in Studio noch nicht alles freigeben. Merge geht per Klick. Go und Accept haben noch keinen Button.
- Viele kleine Fehler kommen erst raus, wenn du klickst. Die Prüf-Tools sehen zu wenig von der echten App.

## Warum immer wieder dieselben Fehler

Studio erlaubt, dass eine Seite ein vorhandenes Teil neu zeichnet, statt es einzubetten. Dann entsteht eine zweite
Code-Kopie, zum Beispiel ein zweiter Canvas oder ein zweiter Picker. Die Prüfungen sehen jedes Teil nur allein, darum
fällt der Unterschied nie auf.

Was Studio besser machen muss:

- Ein Teil wird eingebettet, nicht kopiert. Studio lehnt eine Kopie ab.
- Für jedes Verhalten gibt es genau eine Umsetzung. Eine Prüfung meldet jede zweite.
- Die Prüfungen klicken dasselbe auf allen Seiten und vergleichen das Ergebnis.

## Nächste Schritte (in dieser Reihenfolge, langsam, eins nach dem anderen)

1. Freigeben per Klick in Studio (Go und Accept). Danach gibst du nichts mehr über die Kommandozeile frei.
2. Ein einziger Canvas für System, Sketches und Flows. Linkes Ziehen verschiebt überall.
3. Spalte „Aktuell“ im Sketch: zeigt immer einen echten Vergleich.
4. Fehler-Toast fertig machen und mergen.
5. Teil für Teil auf „ready“ bringen, bis 19 von 19.
6. Danach: deine Feedback-Runde über die gesammelten Lektionen und den Backlog.

## Was du tun musst

Nichts, bis Schritt 1 fertig ist. Dann liegen deine Freigaben als Buttons in Studio.

## Details (nur bei Bedarf)

- Entscheidungen und Lektionen: `plans/ethlete-studio/design-to-code.md`
- Später-Liste: `plans/ethlete-studio/backlog-parallel.md`
