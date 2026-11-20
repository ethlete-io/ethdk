# Studio – Warteschlange, Rest

Fortsetzung der Warteschlange in [STATUS.md](STATUS.md), eine Liste (ADR 0351, 0354).

### Warteschlange, Rest

7. **Windows-CEF-Spike (B480)** ⏳ Tagschicht (ADR 0239): Spike CEF auf Windows wie B469 (Build läuft, Live-Frames, ... - Builder
8. **Veraltete Mocks-dist (B256)** ⏳ Veraltetes dist der Design-Mocks ist Problem: check/ready/shot lehnen ab mit ... - Builder
9. **Surface-Probleme Hosts (B266)** ⏳ Host-Seiten-Shot 76e05386a; offen: Echtdaten-Lauf - Builder
10. **Motion-Shot settleFrames (B268)** ⏳ motion-shot.ts setzt settleFrames ein (Animationen auch in eingebetteten Frames beenden), ... - Builder
11. **Kommentar-Platzierung (B278)** ⏳ capability-place.spec rot auf echten Daten: comment-write emit:send vs pages/inbox ... - Builder
12. **Eltern-Revision vergleichen (B283)** ⏳ compare an einer Eltern-Revision: unterstützter Weg über den e2e-check-Baum (eigene ... - Builder
13. **e2e-check Hook-sha (B299)** ⏳ e2e-check.spec bekommt die sha vom Hook (env/arg), läuft im Pre-commit-Index-Checkout ... - Builder
14. **Abgeschnittener Text (B300)** ⏳ Regel TEXT-TRUNCATED: abgeschnittener Inhaltstext pro State ist ein Befund; Opt-out ... - Builder
15. **Stale-dist HEAD-Blobs (B301)** ⏳ Stale-dist-Hash nur über committete Quellen (HEAD-Blobs); Agent-Briefs verbieten Edits an ... - Builder
16. **CI-Bereichsprüfung (B335)** 🔨 CI prüft den gepushten Bereich: commitlint + `yarn test:tools`; Pre-push prüft commitlint ... - Builder
17. **UI-Liste zweite Session (B398)** 🔨 UI-Builder (zweite Session) baut die UI-Liste: A1 gebaut ff698951f; title-bar@notice-hint ... - Builder (c8)
18. **Regel-Commit pro Produkt (B401)** 🔨 Neue Design-Regel läuft im eigenen Commit über alle Produkte; alte Treffer in eine ... - SDK-Builder (cb)
19. **Werkzeuglücken-Grenze (B403)** 🔨 UI-Builder untersucht nur Werkzeuglücken, die ihn blockieren; alle anderen in einem Satz ... - Builder (c8)
20. **Design-Hintergrundprozess (B404)** 🔨 Design-Hintergrundprozess (Bef. 492, 493): S1 Lib-Build-Sperre, S2 Prozess + Client + ... - Builder (c0)
21. **Drift-Baseline (B405)** 🔨 Alte Implementierungs-Drift (sketches, system, canvas-frames) in schrumpfende Baseline ... - cb, dann c8
22. **Zoom-Budget im Canvas (B356)** ⏳ Budget gilt für die CEF-App, Mac und Linux (ADR 0390). Safari-Aufnahmen: p95 586 ms beim Zoomen, Suspect Live-Vorschauen starten während der Geste neu; Bite 0c368fd15 friert Live-Frames während der Geste ein: Linux-Chromium max 67-83 -> 17-33 ms, Neustarts 5 -> 0. Offen: CEF Linux (Toms Studio 5 min zu) und Mac messen - Builder
23. **GitHub-Issues Design-CLI (B648)** ⏳ #3190, #3191, #3195, #3197 geschlossen, #3194 war behoben; offen: #3196 wartet auf Reporter-Markup - Builder
24. **Freigegebene Studio-Themen (B660)** ⏳ alle fünf gebaut und geprüft (lokal); schließen nach grünem CI auf dem Push, der sie enthält - Builder
25. **Leere Warteschlange (B661)** ⏳ builder-agent-Skill: ohne startbaren Eintrag A, dann D, dann C, sonst Meldung an Doc (ADR 0388); bis zum Reset sortiert ein Recherche-Agent alle Einträge gegen git - Builder
