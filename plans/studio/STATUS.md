# Studio – Status

Stand: 20.11.2026, nachts

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
4. **Control-Rand und Hover (B640)** ⏳ gebaut (b290646ca, aadefd64d); offen: Live-Bild der Checkbox im Zeilen-Editor - Builder
5. **Timetrack-Beschreibung (B602)** ⏳ Tag-Aufbau linear und im Web Worker, Git-Watch ignoriert Dateizugriffe, MR-Abgleich ein git log pro Repo (5a09de401, a30be57c7). Offen: Rest-Blockaden 65-330 ms im JS-Thread (Git-Ankunft, Tag-Computeds, probeScanOf), namingSettled liest alte Zeilen, Host-Speicherleck, Tom bestätigt Scrollen, Live-Bild; Anruf ohne Vorschlag - Builder
6. **Timetrack-Gleichstand (B616)** ⏳ gebuchte Zeilen reisen, 18.11.-Regression behoben (ADR 0038), Warteschlangen-Dedup. Offen: Live-Vergleich beider Rechner auf einem Commit (Timetrack ADR 0047), neue ID bei erneutem Anlegen, Warteschlange über Rechner - Builder
7. **Eigene CI-Runner, neuer Testlauf (B580)** ⏳ Verdaccio-Check am Anfang des Laufs (6d9b1b8e9); `@ethlete` wird gespeichert wie `@ethlete-producer`, ohne npmjs-Uplink. Offen: Testlauf mit `CI_SELF_HOSTED`, notieren wo er stoppt - Builder

Geparkt: B105, B108, B109, B148.

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
