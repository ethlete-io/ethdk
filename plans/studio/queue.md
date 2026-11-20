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
24. **DROPPED-PROP-Abbau (B410)** ⏳ 11 Canvas-Inputs gelöscht (907b8a709); offen: toter Code - Builder (c0)
25. **Merged-Hash-Regel (B412)** 📋 Veralteter merged-Hash: Regel DIRECT-EDIT-PENDING für gemergte Teile, deren Hash ohne ... - c0
26. **compare schneller (B416)** ⏳ erster Watch-Build nach Neustart nutzt den Harness-Cache (3fc2811e1): compare pages/sketches kalt 13,4 -> 2,5 s, check studio --part kalt 44,6 -> 7,9 s. Offen: lib-build-wait 33,8 s nach HEAD-Wechsel (Suspect), check sdk Rest 7-9 s warm - c0
27. **WebKit-Zoom-Budget (B356)** ⏳ Einschwingen ohne Fit-Neumessung (5a6c656f2): Linux-WebKit p95 37-43 ms lokal; im CI nur gemessen, ohne GPU (530bdb826); offen: p95 ≤ 33 ms lokal, Mac-Zahl (Tom morgens) - Builder
28. **GitHub-Issues Design-CLI (B648)** ⏳ gebaut (lokal, Push nach CI): #3190 f8bd27c99, #3191 3b69a862a, #3195 1f6782dbe, #3196 Warnung c2d6d8279 (Reporter-Markup erfragt), #3197 Punkte a/b 0c46921a1, 532e47da8, df9e3f69b; #3194 war schon behoben. #3197 Punkte 1-2 dadfefbd0, 23ec75ed4. #3197 Punkt 3 6ec0c2662; offen: Push, dann #3197 schließen - Builder
29. **Mailbox und Neustart verlieren nichts (B658)** ⏳ restart heilt/verweigert, run scheitert laut (c481bc4e7); offen: run im tmux, Push - Builder
30. **Host-Signal-Test im CI (B645)** 🔨 127 behoben (395a0932f); unter xvfb startet der Host seine Helfer nicht (CI 44701159109, Suspect: CEF-Start ohne GPU/Sandbox/Libs), Schritte wieder raus (57606a507); nächster Versuch: e2e zeigt Host-stderr, ein CI-Lauf - Builder
