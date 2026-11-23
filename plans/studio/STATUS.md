# Studio – Status

Stand: 23.11.2026, morgens

## Ziel

Das MVP ist erreicht (02.11.): alle 17 Studio-Teile sehen im Code so aus wie ihr gemergter Entwurf und sind „fertig“.
Jetzt kommen die Themen für nach dem MVP. Sie stehen in fünf Listen (A bis E) in [lists.md](lists.md). Jeder Eintrag hat eine feste ID (zum Beispiel B21);
erledigte Einträge werden gelöscht, die IDs der anderen bleiben. Die Quelle (Befund oder Q) steht in `archive/findings-2026-11.md`, „dl“ heißt die gelöschte
Entscheidungsliste, ihre Regeln stehen in ADR 0369.

## Regeln

1. Jedes Ding gibt es nur einmal: ein Canvas, ein Picker, keine Kopien.
2. Jeder Fehler wird zuerst ein Test, dann wird er behoben.
3. Werkzeug-Fixes sind allgemein: sie helfen jedem Projekt, nicht nur Studio.
4. Ein Produkt-Thema (Liste A) startet erst, wenn Tom seine Reihenfolge festgelegt hat. Braucht es einen Entwurf, kommt
   zuerst der Entwurf (Liste E).
5. Der Builder wartet nicht auf Tom. Tom bekommt eine kurze Runde, wenn er da ist: höchstens 3 Fragen.

## Ungelandete Desk-Branches

Stand 07.11.: Gebaut, nicht gelandet: B120, B212, B338, B354, B362, B369, B419 (lokale Branches `desk/<ID>`). Mac: `tank/*` auf
origin, Liste in `.claude/handoffs/mac-tank-branches.md`.

## Gerade in Arbeit

### Warteschlange

Der Builder nimmt den ersten offenen Eintrag (ADR 0351). Vor dem Start prüft er ihn gegen git; ist er erledigt, nimmt er den nächsten. Nur der Doc-Agent ordnet die Liste. Ein neuer Befund unterbricht nur bei rotem CI (ADR 0230) oder wenn er den laufenden Eintrag blockiert. Die Zeile „wie gebaut“ steht nur in der Commit-Nachricht (ADR 0350).

1. **Plan-Dateien sortieren (B597)** ⏳ Plan-Dateien sortiert (alle vier Produkte); Rest: übergreifende ADRs nach `docs/adr/` verschieben, B599 ist da (ADR 0354) - Doc-Agent
2. **Prozesszahlen nachmessen (B605)** ⏳ fällig 2026-11-25: Prozesszahlen nachmessen gegen `plans/repo/process-baseline-2026-11-18.md` - Doc-Agent
3. **Consumer-Auslieferung (B610)** ⏳ frühestens 2026-11-25: Plan-Ordnung, Kurznamen, Weg-Modus über agent-rules (ADR 0374) - Builder
4. **Timetrack nach Projekten (B641)** ⏳ nach dem roten CI zuerst: Spalten im Tag zeigen wieder Worktrees (ethlete-sdk-wt-*, 21.11.), obwohl 279b3dc17 sie in die Spalte des Haupt-Checkouts legt; Suspect: keine verlinkten Worktrees oder alter Build. Danach Teil 1 von Timetrack ADR 0057: eine Spalte ist ein Projekt (Tom 23.11.: „sollten längst nur noch Projekte sein“). Browser-Reporter danach - Builder
5. **Zustände in Gruppen (B672)** ⏳ Entwurf nennt die Gruppen seiner Zustände, Zeile mit Überschrift und Anzahl, Ablauf-Reihenfolge, fehlende Gruppe = Befund (ADR 0407); zuerst pages/sketches - Builder
6. **Timetrack-Gleichstand (B616)** ⏳ gebuchte Zeilen reisen, gemeinsame Freigabe-Warteschlange (Timetrack ADR 0053) gebaut. Neuer Build läuft auf tank und mac (Tom 23.11.). Offen: Live-Vergleich auf einem Commit (Timetrack ADR 0047) - Builder
7. **Eigene CI-Runner, neuer Testlauf (B580)** ⏳ Verdaccio-Check am Anfang des Laufs (6d9b1b8e9). Lauf 44646105879 starb vor dem Check: runner-ethlete-2 findet actions/checkout nicht. Verdacht: halber oder geteilter `_actions`-Cache. Offen: frühestens 24.11. löscht Tom `_work/_actions` je Runner (oder getrennte Arbeitsordner) und startet die Runner neu, dann neuer Lauf - Tom, dann Builder

Geparkt: B105, B108, B109, B148, B312, B313.

## Plan-Dateien

- [queue.md](queue.md): Rest der Warteschlange
- [rows.md](rows.md): Eintragstabelle
- [lists.md](lists.md): Maschinerie-Stapel, Listen A-E
- [build-ready.md](build-ready.md)
- [cef-runtime.md](cef-runtime.md)
- [contrast.md](contrast.md)
- [designer-workflow.md](designer-workflow.md)
- [design-system-actions.md](design-system-actions.md) und [design-system-actions/](design-system-actions/)
- [existing-code-import.md](existing-code-import.md)
- [parked-suspects.md](parked-suspects.md)
- [sdk-component-catalog.md](sdk-component-catalog.md)
- [tomflix-inventory.md](tomflix-inventory.md)
