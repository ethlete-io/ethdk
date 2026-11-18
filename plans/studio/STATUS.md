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

1. **B597** ⏳ Plan-Dateien sortiert (alle vier Produkte); Rest: übergreifende ADRs nach `docs/adr/` verschieben, nach B599 (ADR 0354) - Doc-Agent
2. **B599** ⏳ Ablauf-ADRs auf Repo-Ebene: ADR-Skripte lesen auch `docs/adr/`, Zeile in AGENTS.md (ADR 0354) - Builder
3. **B600** ⏳ Doc-Agent bündelt Nachrichten an den Builder alle ~15 Minuten (ADR 0356) - Builder
4. **B601** ⏳ Pushen erst, wenn der laufende CI-Lauf fertig ist (ADR 0357) - Builder
5. **B603** ⏳ Cross-Check als frischer fable-Lauf, nur für manche Fragen; doc-agent- und supervisor-agent-Skill (ADR 0358) - Builder
6. **B605** ⏳ fällig 2026-11-25: Prozesszahlen nachmessen gegen `plans/repo/process-baseline-2026-11-18.md` - Doc-Agent
7. **B606** ⏳ Hook protokolliert Modell, Effort, Aufgabe und Dateien jedes Subagenten (ADR 0371) - Builder
8. **B608** ⏳ Doc-Agent schaltet von selbst auf „weg“ und zurück (Hook-Zeitstempel, 15 Min.), Wiederholregel angepasst (ADR 0372) - Builder
9. **B609** ⏳ Kurznamen: Spalte in rows.md, Warteschlangen-Befehl druckt „Kurzname (Bnnn)“, Skills und Commit-Betreff (ADR 0373) - Builder
10. **B610** ⏳ Consumer-Auslieferung: Plan-Ordnung, Kurznamen, Weg-Modus über agent-rules, frühestens eine Woche nach B608/B609 (ADR 0374) - Builder
11. **B611** ⏳ Bericht auf Abruf: Slash-Befehl druckt eine feste Tabelle im Chat für einen Zeitraum, kein Vorgänger (ADR 0375) - Builder
12. **B612** ⏳ Statuszeile: Mod mit laufender Aufgabe, nach B609 (ADR 0375) - Builder
13. **B613** ⏳ Bericht bei Rückkehr: dieselbe Tabelle für die Abwesenheit, nach B611 und B608 (ADR 0375) - Builder
14. **B602** ⏳ Timetrack: offen nur #4/#5 (gleiche Beschreibung in jeder Spur, ein deutscher Satz), als Letztes (Mensch 18.11.) - Builder

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
