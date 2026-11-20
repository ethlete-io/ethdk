# Studio – Warteschlange, Rest

Fortsetzung der Warteschlange in [STATUS.md](STATUS.md), eine Liste (ADR 0351, 0354).

### Warteschlange, Rest

6. **Windows-CEF-Spike (B480)** ⏳ Tagschicht (ADR 0239): Spike CEF auf Windows wie B469 (Build läuft, Live-Frames, ... - Builder
7. **Veraltete Mocks-dist (B256)** ⏳ Veraltetes dist der Design-Mocks ist Problem: check/ready/shot lehnen ab mit ... - Builder
8. **Surface-Probleme Hosts (B266)** ⏳ Probleme NESTED-SURFACE, LOST-SURFACE, PART-REWRITE; Sketch eines Parts mit Hosts shootet ... - Builder
9. **Motion-Shot settleFrames (B268)** ⏳ motion-shot.ts setzt settleFrames ein (Animationen auch in eingebetteten Frames beenden), ... - Builder
10. **Kommentar-Platzierung (B278)** ⏳ capability-place.spec rot auf echten Daten: comment-write emit:send vs pages/inbox ... - Builder
11. **Eltern-Revision vergleichen (B283)** ⏳ compare an einer Eltern-Revision: unterstützter Weg über den e2e-check-Baum (eigene ... - Builder
12. **System-Page Eingaben (B289)** ⏳ system-page: commentMode, draft, send, reason von KNOWN_UNBOUND_INPUTS nehmen und binden ... - Builder
13. **Part-Fehler sperrt Wahl (B296)** ⏳ Jeder vom Server gemeldete Part-Fehler sperrt die Wahl über einen Pfad, nicht je Ansicht ... - Builder
14. **e2e-check Hook-sha (B299)** ⏳ e2e-check.spec bekommt die sha vom Hook (env/arg), läuft im Pre-commit-Index-Checkout ... - Builder
15. **Abgeschnittener Text (B300)** ⏳ Regel TEXT-TRUNCATED: abgeschnittener Inhaltstext pro State ist ein Befund; Opt-out ... - Builder
16. **Stale-dist HEAD-Blobs (B301)** ⏳ Stale-dist-Hash nur über committete Quellen (HEAD-Blobs); Agent-Briefs verbieten Edits an ... - Builder
17. **CI-Bereichsprüfung (B335)** 🔨 CI prüft den gepushten Bereich: commitlint + `yarn test:tools`; Pre-push prüft commitlint ... - Builder
18. **Studio-Check-Triage (B340)** ⏳ Triage `design check --product studio`: 698 Funde, Exit 1 (DROPPED-PROP 11, LOST-SURFACE ... - Builder
19. **Explorer-Mausrad (B365)** 🔨 gebaut 39142b135 (Mausrad über Zeilennamen), 1b551b85d, 834c4c536, d979079a0 (Live-Frames sitzen in der Zelle, auch waagerecht); offen: CI 44677427631 grün - Builder
20. **UI-Liste zweite Session (B398)** 🔨 UI-Builder (zweite Session) baut die UI-Liste: A1 gebaut ff698951f; title-bar@notice-hint ... - Builder (c8)
21. **Regel-Commit pro Produkt (B401)** 🔨 Neue Design-Regel läuft im eigenen Commit über alle Produkte; alte Treffer in eine ... - SDK-Builder (cb)
22. **Werkzeuglücken-Grenze (B403)** 🔨 UI-Builder untersucht nur Werkzeuglücken, die ihn blockieren; alle anderen in einem Satz ... - Builder (c8)
23. **Design-Hintergrundprozess (B404)** 🔨 Design-Hintergrundprozess (Bef. 492, 493): S1 Lib-Build-Sperre, S2 Prozess + Client + ... - Builder (c0)
24. **Drift-Baseline (B405)** 🔨 Alte Implementierungs-Drift (sketches, system, canvas-frames) in schrumpfende Baseline ... - cb, dann c8
25. **DROPPED-PROP-Abbau (B410)** 📋 DROPPED-PROP-Baseline abbauen: je eine Skizze für canvas-frames, pages/sketches, ... - c0
26. **Merged-Hash-Regel (B412)** 📋 Veralteter merged-Hash: Regel DIRECT-EDIT-PENDING für gemergte Teile, deren Hash ohne ... - c0
27. **Zugänglicher-Name-Regel (B413)** 📋 Regel ACCESSIBLE-NAME: zugänglicher Name eines Controls Design vs. App vergleichen; ... - c0
28. **Resident-e2e (B414)** 📋 Resident-e2e-Spec: echter Hintergrundprozess, compare, Part ändern, compare erneut - ... - c0
29. **compare schneller (B416)** 📋 compare schneller (Bef. 521): App-Shots parallel, S4 Bild-Cache vorziehen, mehrere Parts ... - c0
30. **WebKit-Zoom-Budget (B356)** ⏳ Einschwingen ohne Fit-Neumessung (5a6c656f2): Linux-WebKit p95 ~97 -> 37-43 ms (4/6 Läufe); offen: p95 ≤ 33 ms, Mac-Zahl (Tom morgens) - Builder
31. **Standings-Zonenstärke (B620)** ⏳ SDK (fifagg S2): `StandingsZone.strength` als CSS-Variable am Band, Tagschicht - Builder
32. **Standings-Form-Tooltip (B621)** ⏳ SDK (fifagg S3): optionales Template für den Form-Tooltip, Tagschicht - Builder
33. **Button-Druck-Variante (B625)** ⏳ SDK (fifagg S7): Input `pressedVariant`, Standard = heutige Zuordnung - Builder
34. **Host-Signal-Test im CI (B645)** ⏳ Tagschicht: CEF-Dateien im CI neben das Host-Binary kopieren (Exit 127, libcef.so fehlt), lokalen Fehlschlag mit CEF beheben, dann Schritt wieder rein (zurückgenommen 54d5f1df6) - Builder
