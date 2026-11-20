# Studio – Warteschlange, Rest

Fortsetzung der Warteschlange in [STATUS.md](STATUS.md), eine Liste (ADR 0351, 0354).

### Warteschlange, Rest

7. **Windows-CEF-Spike (B480)** ⏳ Tagschicht (ADR 0239): Spike CEF auf Windows wie B469 (Build läuft, Live-Frames, ... - Builder
8. **Veraltete Mocks-dist (B256)** ⏳ Veraltetes dist der Design-Mocks ist Problem: check/ready/shot lehnen ab mit ... - Builder
9. **Surface-Probleme Hosts (B266)** ⏳ Probleme NESTED-SURFACE, LOST-SURFACE, PART-REWRITE; Sketch eines Parts mit Hosts shootet ... - Builder
10. **Motion-Shot settleFrames (B268)** ⏳ motion-shot.ts setzt settleFrames ein (Animationen auch in eingebetteten Frames beenden), ... - Builder
11. **Kommentar-Platzierung (B278)** ⏳ capability-place.spec rot auf echten Daten: comment-write emit:send vs pages/inbox ... - Builder
12. **Eltern-Revision vergleichen (B283)** ⏳ compare an einer Eltern-Revision: unterstützter Weg über den e2e-check-Baum (eigene ... - Builder
13. **System-Page Eingaben (B289)** ⏳ system-page: commentMode, draft, send, reason von KNOWN_UNBOUND_INPUTS nehmen und binden ... - Builder
14. **Part-Fehler sperrt Wahl (B296)** ⏳ Jeder vom Server gemeldete Part-Fehler sperrt die Wahl über einen Pfad, nicht je Ansicht ... - Builder
15. **e2e-check Hook-sha (B299)** ⏳ e2e-check.spec bekommt die sha vom Hook (env/arg), läuft im Pre-commit-Index-Checkout ... - Builder
16. **Abgeschnittener Text (B300)** ⏳ Regel TEXT-TRUNCATED: abgeschnittener Inhaltstext pro State ist ein Befund; Opt-out ... - Builder
17. **Stale-dist HEAD-Blobs (B301)** ⏳ Stale-dist-Hash nur über committete Quellen (HEAD-Blobs); Agent-Briefs verbieten Edits an ... - Builder
18. **CI-Bereichsprüfung (B335)** 🔨 CI prüft den gepushten Bereich: commitlint + `yarn test:tools`; Pre-push prüft commitlint ... - Builder
19. **UI-Liste zweite Session (B398)** 🔨 UI-Builder (zweite Session) baut die UI-Liste: A1 gebaut ff698951f; title-bar@notice-hint ... - Builder (c8)
20. **Regel-Commit pro Produkt (B401)** 🔨 Neue Design-Regel läuft im eigenen Commit über alle Produkte; alte Treffer in eine ... - SDK-Builder (cb)
21. **Werkzeuglücken-Grenze (B403)** 🔨 UI-Builder untersucht nur Werkzeuglücken, die ihn blockieren; alle anderen in einem Satz ... - Builder (c8)
22. **Design-Hintergrundprozess (B404)** 🔨 Design-Hintergrundprozess (Bef. 492, 493): S1 Lib-Build-Sperre, S2 Prozess + Client + ... - Builder (c0)
23. **Drift-Baseline (B405)** 🔨 Alte Implementierungs-Drift (sketches, system, canvas-frames) in schrumpfende Baseline ... - cb, dann c8
24. **Merged-Hash-Regel (B412)** ⏳ gebaut 21360c443; schließen nach grünem CI auf dem Push - Builder
25. **WebKit-Zoom-Budget (B356)** ⏳ Linux p95 ~46 ms; Mac WebKit p95 ~170 ms, ssh ausgeschlossen, content-visibility ohne Gewinn (gemessen). Tom nimmt am Mac eine Safari-Timeline auf (agent-results/b356-safari-steps.md, nach dem Push); ADR 0386 - Tom, dann Builder
26. **GitHub-Issues Design-CLI (B648)** ⏳ #3190, #3191, #3195, #3197 geschlossen, #3194 war behoben; offen: #3196 wartet auf Reporter-Markup - Builder
27. **Match-Teilnehmer bearbeitbar (B659)** ⏳ gebaut e3d90c8fb, 821fb877a; schließen nach grünem CI, dann fifa S27 Version - Builder
28. **Freigegebene Studio-Themen (B660)** ⏳ in dieser Folge: Studio-Menü Rest (A26), Inbox (A19), Server-Status (A27), Schnellwahl (A6), Kommentar-Pins an gemergten Skizzen (A18); ohne Entwurf baut der Builder seine eigene Skizze (ADR 0387) - Builder
29. **Leere Warteschlange (B661)** ⏳ builder-agent-Skill: ohne startbaren Eintrag A, dann D, dann C, sonst Meldung an Doc (ADR 0388); bis zum Reset sortiert ein Recherche-Agent alle Einträge gegen git - Builder
