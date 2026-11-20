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
18. **UI-Liste zweite Session (B398)** 🔨 UI-Builder (zweite Session) baut die UI-Liste: A1 gebaut ff698951f; title-bar@notice-hint ... - Builder (c8)
19. **Regel-Commit pro Produkt (B401)** 🔨 Neue Design-Regel läuft im eigenen Commit über alle Produkte; alte Treffer in eine ... - SDK-Builder (cb)
20. **Werkzeuglücken-Grenze (B403)** 🔨 UI-Builder untersucht nur Werkzeuglücken, die ihn blockieren; alle anderen in einem Satz ... - Builder (c8)
21. **Design-Hintergrundprozess (B404)** 🔨 Design-Hintergrundprozess (Bef. 492, 493): S1 Lib-Build-Sperre, S2 Prozess + Client + ... - Builder (c0)
22. **Drift-Baseline (B405)** 🔨 Alte Implementierungs-Drift (sketches, system, canvas-frames) in schrumpfende Baseline ... - cb, dann c8
23. **DROPPED-PROP-Abbau (B410)** 📋 DROPPED-PROP-Baseline abbauen: je eine Skizze für canvas-frames, pages/sketches, ... - c0
24. **Merged-Hash-Regel (B412)** 📋 Veralteter merged-Hash: Regel DIRECT-EDIT-PENDING für gemergte Teile, deren Hash ohne ... - c0
25. **Zugänglicher-Name-Regel (B413)** 📋 Regel ACCESSIBLE-NAME: zugänglicher Name eines Controls Design vs. App vergleichen; ... - c0
26. **Resident-e2e (B414)** 📋 Resident-e2e-Spec: echter Hintergrundprozess, compare, Part ändern, compare erneut - ... - c0
27. **compare schneller (B416)** 📋 compare schneller (Bef. 521): App-Shots parallel, S4 Bild-Cache vorziehen, mehrere Parts ... - c0
28. **WebKit-Zoom-Budget (B356)** ⏳ Einschwingen ohne Fit-Neumessung (5a6c656f2): Linux-WebKit p95 37-43 ms lokal; im CI nur gemessen, ohne GPU (530bdb826); offen: p95 ≤ 33 ms lokal, Mac-Zahl (Tom morgens) - Builder
29. **GitHub-Issues Design-CLI (B648)** ⏳ Meldungen eines SDK-Nutzers vom 19.11.: ethdk #3190, #3191, #3194, #3195, #3196, #3197; #3190 blockiert (ADR 0377), nach dem laufenden B416-Teil; #3189, #3192, #3193 behoben (8839a3ec5) - Builder
30. **Pip-Rand bei versteckter Titelleiste (B649)** ⏳ blockiert fifagg: `et-pip-window:after` verschiebt den vollen Hintergrund um die Titelleisten-Höhe nach unten; ohne Hover 32 px ... - Builder
31. **Scrollable-Buttons app-weit (B650)** ⏳ blockiert fifagg: Provider für `et-scrollable`-Buttons (an je Breakpoint, Position inside/inline an den Zeilenenden) statt `etSc... - Builder
32. **Sticky-Kind über dem Scroll-Fade (B651)** ⏳ blockiert fifagg: Fade ist mask-image am Scroll-Container, ein sticky Kind (left:0) bleibt im verblassten Bereich. Öffentliches ... - Builder
33. **Pagination scrollt nur nach oben (B652)** ⏳ blockiert fifagg: `FloatingActionDirective.scrollToTop` scrollt beim Seitenwechsel in beide Richtungen; Option: nur nach oben, w... - Builder
34. **Host-Signal-Test im CI (B645)** 🔨 127 behoben (395a0932f); unter xvfb startet der Host seine Helfer nicht (CI 44701159109, Suspect: CEF-Start ohne GPU/Sandbox/Libs), Schritte wieder raus (57606a507); nächster Versuch: e2e zeigt Host-stderr, ein CI-Lauf - Builder
35. **Strg+C beim CEF-Start (B647)** ⏳ Tagschicht: ein echtes Strg+C in den ersten ~400 ms des CEF-Starts geht im Host verloren; Fix in tauri-runtime-cef oder Signalmaske im Host - Builder
36. **Carousel mit einer Folie (B653)** ⏳ fifagg, nicht blockiert - Builder
37. **Segment-Gruppe im Scrollable (B654)** ⏳ fifagg, nicht blockiert - Builder
38. **et-label in et-dropzone (B655)** ⏳ fifagg, nicht blockiert - Builder
39. **Dropzone resolveExisting mit Bild-Varianten (B656)** ⏳ fifagg, nicht blockiert - Builder
40. **Tab-Unterstrich in Label-Breite (B657)** ⏳ fifagg, nicht blockiert - Builder
