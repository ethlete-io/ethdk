# Studio – Warteschlange, Rest

Fortsetzung der Warteschlange in [STATUS.md](STATUS.md), eine Liste (ADR 0351, 0354).

### Warteschlange, Rest

12. **Veraltete Mocks-dist (B256)** ⏳ Veraltetes dist der Design-Mocks ist Problem: check/ready/shot lehnen ab mit ... - Builder
13. **Surface-Probleme Hosts (B266)** ⏳ Host-Seiten-Shot 76e05386a; offen: Echtdaten-Lauf - Builder
14. **Motion-Shot settleFrames (B268)** ⏳ motion-shot.ts setzt settleFrames ein (Animationen auch in eingebetteten Frames beenden), ... - Builder
15. **Kommentar-Platzierung (B278)** ⏳ capability-place.spec rot auf echten Daten: comment-write emit:send vs pages/inbox ... - Builder
16. **Eltern-Revision vergleichen (B283)** ⏳ compare an einer Eltern-Revision: unterstützter Weg über den e2e-check-Baum (eigene ... - Builder
17. **e2e-check Hook-sha (B299)** ⏳ e2e-check.spec bekommt die sha vom Hook (env/arg), läuft im Pre-commit-Index-Checkout ... - Builder
18. **Abgeschnittener Text (B300)** ⏳ Regel TEXT-TRUNCATED: abgeschnittener Inhaltstext pro State ist ein Befund; Opt-out ... - Builder
19. **Stale-dist HEAD-Blobs (B301)** ⏳ Stale-dist-Hash nur über committete Quellen (HEAD-Blobs); Agent-Briefs verbieten Edits an ... - Builder
20. **CI-Bereichsprüfung (B335)** 🔨 CI prüft den gepushten Bereich: commitlint + `yarn test:tools`; Pre-push prüft commitlint ... - Builder
21. **UI-Liste zweite Session (B398)** 🔨 UI-Builder (zweite Session) baut die UI-Liste: A1 gebaut ff698951f; title-bar@notice-hint ... - Builder (c8)
22. **Regel-Commit pro Produkt (B401)** 🔨 Neue Design-Regel läuft im eigenen Commit über alle Produkte; alte Treffer in eine ... - SDK-Builder (cb)
23. **Werkzeuglücken-Grenze (B403)** 🔨 UI-Builder untersucht nur Werkzeuglücken, die ihn blockieren; alle anderen in einem Satz ... - Builder (c8)
24. **Design-Hintergrundprozess (B404)** 🔨 Design-Hintergrundprozess (Bef. 492, 493): S1 Lib-Build-Sperre, S2 Prozess + Client + ... - Builder (c0)
25. **Drift-Baseline (B405)** 🔨 Alte Implementierungs-Drift (sketches, system, canvas-frames) in schrumpfende Baseline ... - cb, dann c8
26. **Zoom-Budget im Canvas (B356)** ⏳ Budget gilt für die CEF-App, Mac und Linux (ADR 0390). Safari-Aufnahmen: p95 586 ms beim Zoomen, Suspect Live-Vorschauen starten während der Geste neu; Bite 0c368fd15 friert Live-Frames während der Geste ein: Linux-Chromium max 67-83 -> 17-33 ms, Neustarts 5 -> 0. Offen: CEF Linux (Studio des Menschen 5 min zu) und Mac messen - Builder
27. **GitHub-Issues Design-CLI (B648)** ⏳ #3190, #3191, #3195, #3197 geschlossen, #3194 war behoben; offen: #3196 wartet auf Reporter-Markup - Builder
28. **Leere Warteschlange (B661)** ⏳ builder-agent-Skill: ohne startbaren Eintrag A, dann D, dann C, sonst Meldung an Doc (ADR 0388); bis zum Reset sortiert ein Recherche-Agent alle Einträge gegen git - Builder
29. **App-Signatur (B666)** ⏳ Windows (Azure Trusted Signing) und macOS in einem Rutsch mit dem Menschen (ADR 0389, 0404); erst wenn nötig, jetzt nicht (der Mensch 23.11.) - der Mensch, dann Builder
