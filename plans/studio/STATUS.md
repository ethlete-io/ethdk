# Studio – Status

Stand: 18.11.2026, nachmittags

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
3. **Consumer-Auslieferung (B610)** ⏳ Plan-Ordnung, Kurznamen, Weg-Modus über agent-rules, frühestens eine Woche nach B608/B609 (ADR 0374) - Builder
4. **Builder-Takt (B618)** ⏳ parallel höchstens zwei Themen, kein Warten auf CI/Hilfsagent/Antwort; rotes CI hält nur bei unbekannter Ursache ohne Fix; builder-agent Start-Schritt 4 und Takt-Regel angleichen (ADR 0376) - Builder
5. **Bericht auf Abruf (B611)** ⏳ Slash-Befehl druckt eine feste Tabelle im Chat für einen Zeitraum, kein Vorgänger (ADR 0375) - Builder
6. **Statuszeile-Mod (B612)** ⏳ Statuszeile: Mod mit laufender Aufgabe, nach B609 (ADR 0375) - Builder
7. **Bericht bei Rückkehr (B613)** ⏳ dieselbe Tabelle für die Abwesenheit, nach B611 und B608 (ADR 0375) - Builder
8. **Timetrack-Beschreibung (B602)** ⏳ Timetrack: offen #4/#5 (gleiche Beschreibung in jeder Spur, ein deutscher Satz) und #22 neu (Revert a825cba41: brach e2e call-end-here), als Letztes (Mensch 18.11.) - Builder
9. **Timetrack-Gleichstand (B616)** ⏳ gekoppelte Rechner zeigen denselben Tag, SSH-Arbeit auf tank erscheint auf dem Mac (Timetrack ADR 0047) - Builder

Geparkt: B105, B108, B109, B580, B148.

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
