# Studio – Warteschlange, Rest

Fortsetzung der Warteschlange in [STATUS.md](STATUS.md), eine Liste (ADR 0351, 0354).

### Warteschlange, Rest

16. **B611** ⏳ Bericht auf Abruf: Slash-Befehl erzeugt die Berichtsseite für einen Zeitraum, kein Vorgänger (ADR 0375) - Builder
17. **B612** ⏳ Statuszeile: Mod mit laufender Aufgabe, nach B609 (ADR 0375) - Builder
18. **B613** ⏳ Bericht bei Rückkehr: drei Zeilen + Link, nach B611 und B608 (ADR 0375) - Builder
19. **B614** ⏳ Live-Pane: am Berichtsbefehl, zuletzt (ADR 0375) - Builder
20. **B422** ⏳ Verify-Brief-Prüfung: `lint:no-verify-briefs` prüft nur getrackte Dateien, NEGATED bekommt „no“, umbrochene ... - Builder
21. **B477** ⏳ Mac-Knopftext: UI-Fehler, nur Mac: Text in `button.et-surface-interactive` auf elements/canvas-frames ... - Builder
22. **B480** ⏳ Windows-CEF-Spike: Tagschicht (ADR 0239): Spike CEF auf Windows wie B469 (Build läuft, Live-Frames, ... - Builder
23. **B482** ⏳ Release-Smoke Bundle: Release-Smoke: das Release-Bundle von Studio einmal starten, ein Sketch öffnen und bei ... - Builder
24. **B490** ⏳ Design-Schriften: Tagschicht: Design-Styles liefern eine Monospace- und die UI-Schrift selbst (ADR 0262, ... - Linux 210235327; Mac offen
25. **B508** ⏳ SDK-Teile FIFA-Look: SDK (fifagg, ADR 0297), nach B507 + Breadcrumb-Tokens: Menüpunkt-Ladezustand; ... - Builder
26. **B255** ⏳ Part-Baum Probleme: Part-Baum: Sketch-Titel nennt Variante, Regel, Meldung; Produkt-Probleme hängen am Part ... - Builder
27. **B256** ⏳ Veraltete Mocks-dist: Veraltetes dist der Design-Mocks ist Problem: check/ready/shot lehnen ab mit ... - Builder
28. **B257** ⏳ Switch-Spur-Rahmen: Sketch sdk switch: Rahmen der leeren Spur ja/nein; danach entfällt switchStyles in inbox ... - Builder
29. **B266** ⏳ Surface-Probleme Hosts: Probleme NESTED-SURFACE, LOST-SURFACE, PART-REWRITE; Sketch eines Parts mit Hosts shootet ... - Builder
30. **B268** ⏳ Motion-Shot settleFrames: motion-shot.ts setzt settleFrames ein (Animationen auch in eingebetteten Frames beenden), ... - Builder
31. **B274** ⏳ Rebase Deklarationen: sketch rebase trägt reine Deklarations-Änderungen eines Parts (controls, motions, states) ... - Builder
32. **B275** ⏳ Skizzenlose Oberfläche: Problem UNSKETCHED-UI: App-Template-Diff fügt sichtbares Element ohne gewählten ... - Builder
33. **B264b** ⏳ Motions-Hinweis Checks: Motions-Hinweis auch in design check/part-check: Text nach open-points.ts verschieben ... - Builder
34. **B276** ⏳ Part-Name-Treffer: Part ohne implements, dessen Name eine App-Komponente trifft → Problem mit Pfad; Treffer ... - Builder
35. **B277** ⏳ Gleiche Frame-Queue: sketch check/ready laden Frames über dieselbe Queue (gleiches N) wie Studio; Mutation N ... - Builder
36. **B278** ⏳ Kommentar-Platzierung: capability-place.spec rot auf echten Daten: comment-write emit:send vs pages/inbox ... - Builder
37. **B279** ⏳ Unnützer Skip: Regel SKIP-UNUSED: data-et-skip ohne unterdrücktes Problem in jedem Zustand ist Problem; ... - Builder
38. **B283** ⏳ Eltern-Revision vergleichen: compare an einer Eltern-Revision: unterstützter Weg über den e2e-check-Baum (eigene ... - Builder
39. **B284** ⏳ Shot-Frame-Menge: Sketch-Shot zeichnet genau die Frame-Menge der Studio-Ansicht (eine Listenfunktion, Spec ... - Builder
40. **B289** ⏳ System-Page Eingaben: system-page: commentMode, draft, send, reason von KNOWN_UNBOUND_INPUTS nehmen und binden ... - Builder
41. **B295** ⏳ Prüfungen ins Studio: Studio-Prüfungen aus dem Pre-Push in Studios Prüfsystem (Specs, Design-Check, Live-Check, ... - Builder
42. **B296** ⏳ Part-Fehler sperrt Wahl: Jeder vom Server gemeldete Part-Fehler sperrt die Wahl über einen Pfad, nicht je Ansicht ... - Builder
43. **B299** ⏳ e2e-check Hook-sha: e2e-check.spec bekommt die sha vom Hook (env/arg), läuft im Pre-commit-Index-Checkout ... - Builder
44. **B300** ⏳ Abgeschnittener Text: Regel TEXT-TRUNCATED: abgeschnittener Inhaltstext pro State ist ein Befund; Opt-out ... - Builder
45. **B301** ⏳ Stale-dist HEAD-Blobs: Stale-dist-Hash nur über committete Quellen (HEAD-Blobs); Agent-Briefs verbieten Edits an ... - Builder
46. **B303** ⏳ Startphase im Status: Studio-Status nennt die Startphase ("CLI wird gebaut") mit Laufzeit (Bef. 355) - Builder
47. **B304** ⏳ Mac-Ampel zentriert: macOS-Ampel vertikal in der Titelleiste zentrieren + Fensterprüfung (Bef. 357) - Builder
48. **B306** ⏳ Shot-Fehlerzustand: Fehlgeschlagener Shot: Fehlerzustand statt kaputtem Bild; kein "Nichts offen" bei ... - Builder
49. **B307** ⏳ Parser-Specs CI-Fixture: Parser-Specs für Tool-Ausgabe mit echten CI-Logs als Fixture (Bef. 360) - Builder
50. **B308** ⏳ Personennamen-Prüfung: Prüfung auf Personennamen in libs/, apps/, apps/docs, .ethlete/design; Rolle "human" ... - Builder
51. **B310** ⏳ Freeze-Schutz: Studio-Freeze: WebKit-Bug bei Top-Level-Await + Iframe-Entfernen; TLA raus, TLA-Guard, ... - Builder
52. **B311** ⏳ SSE-Heartbeat: Leere Frames: WKWebView schließt SSE nach 60 s ohne Bytes, Reconnect remountet alles, ... - Builder
53. **B312** ⏳ Overscroll-Sperre: Overscroll der Shell: overscroll-behavior none überall (de2b83743); Scroll-Kanten-Probe ... - Builder
54. **B313** ⏳ Canvas-Isolation: Frames über dem Explorer unter Last: isolate + contain-paint am Canvas (de2b83743); ... - Builder
55. **B315** ⏳ Sicherer Neustart: Neu-starten-Klick tötet Server bei dirty libs/cli: Neustart nur aus Commit-Kopie ... - Builder
56. **B317** ⏳ Schnelles Erstlisting: Erstes Listing langsam: Regel-Checks blockieren den Server, Abbruch nur im Client; Worker ... - Builder
57. **B319** ⏳ Direct-Edit-Ziel: Leerer Direct-edit-Sketch: Ziel als Part-Key, old mit neuem shared/, englische Texte; ... - Builder
58. **B332** ⏳ Sketch-Import-Regel: Design-Check-Regel: löst die Imports jeder Sketch-Variante auf, damit ein veraltetes ... - Builder
59. **B335** 🔨 CI prüft den gepushten Bereich: commitlint + `yarn test:tools`; Pre-push prüft commitlint ... - Builder
60. **B340** ⏳ Studio-Check-Triage: Triage `design check --product studio`: 698 Funde, Exit 1 (DROPPED-PROP 11, LOST-SURFACE ... - Builder
61. **B342** ⏳ Sketch-Check-Reopen: `sketch check`: Variante mit geänderten unberührten Zuständen ist Fehler; `sketch ... - Builder
62. **B344** ⏳ Rebase nur Gewählte: `sketch rebase` nach einer Wahl portiert nur die gewählte Variante; zwei offene Sketches ... - Builder
63. **B349** ⏳ Merge startet e2e: Merge startet die e2e-Fälle des gemergten Parts; 3 Fälle rot nach den Merges vom 04.11. ... - Builder
64. **B350** ⏳ Systemseite-Tempo: `/__design/system`: kalt ~60 s Wartezeit, warm Stall 1 s (Mac); kalt < 5 s, warm < 200 ... - Builder
65. **B365** ⏳ Explorer-Mausrad: Explorer: Mausrad über Tree-Item-Innenfläche scrollt spät; Messung in CEF (Zeile vs. ... - Builder
66. **B375** ⏳ Scheduler-Check-Zeit: `design check`: `components/scheduler` braucht 120 s (vermutlich Render-Timeout), 18 % ... - Builder
67. **B376** ⏳ Commit-Hook-Tempo: Commit-Hook braucht ~100 s (`vitest related` + Typecheck): messen, wo die Zeit hingeht, ... - Builder
68. **B381** ⏳ Native-Titel-Prüfung: SDK: native `title` dort, wo ein `aria-label` passt, prüfen (Passwort-Feld, PiP, ... - Builder
69. **B391** ⏳ Flaky e2e-Vollauf: Zwei Studio-e2e-Fälle flaky nur im vollen Lauf: Live-Frame-Limit nach Abstand zur Ansicht ... - Builder
70. **B398** 🔨 UI-Builder (zweite Session) baut die UI-Liste: A1 gebaut ff698951f; title-bar@notice-hint ... - Builder (c8)
71. **B399** 🔨 Performance zuerst: `design compare` (Bef. 477), sketch ready/check, C1 ... - Builder (c0)
72. **B401** 🔨 Neue Design-Regel läuft im eigenen Commit über alle Produkte; alte Treffer in eine ... - SDK-Builder (cb)
73. **B403** 🔨 UI-Builder untersucht nur Werkzeuglücken, die ihn blockieren; alle anderen in einem Satz ... - Builder (c8)
74. **B404** 🔨 Design-Hintergrundprozess (Bef. 492, 493): S1 Lib-Build-Sperre, S2 Prozess + Client + ... - Builder (c0)
75. **B405** 🔨 Alte Implementierungs-Drift (sketches, system, canvas-frames) in schrumpfende Baseline ... - cb, dann c8
76. **B406** 📋 Skizzen-Merge prüft in sauberer Kopie von HEAD + nur der Skizze; fremde ungespeicherte ... - cb
77. **B410** 📋 DROPPED-PROP-Baseline abbauen: je eine Skizze für canvas-frames, pages/sketches, ... - c0
78. **B412** 📋 Veralteter merged-Hash: Regel DIRECT-EDIT-PENDING für gemergte Teile, deren Hash ohne ... - c0
79. **B413** 📋 Regel ACCESSIBLE-NAME: zugänglicher Name eines Controls Design vs. App vergleichen; ... - c0
80. **B414** 📋 Resident-e2e-Spec: echter Hintergrundprozess, compare, Part ändern, compare erneut - ... - c0
81. **B416** 📋 compare schneller (Bef. 521): App-Shots parallel, S4 Bild-Cache vorziehen, mehrere Parts ... - c0
82. **B370** ⏳ Studio-Host endet bei Ctrl+C/SIGTERM: erst Beweis an zweiter Debug-Instanz, dann Host-e2e ... - Builder
83. **B368** ⏳ `et design`: Serve-Zustand zeigt Besitzer des Ports (Studio-App oder Terminal), bedienten ... - Builder
84. **B356** ⏳ Zoom in WebKit ~20 fps (Chromium 60): WebKit-Budget Frame-Intervall p50 ≤ 20 ms, p95 ≤ 33 ... - Builder
85. **B100** ⏳ Restliche prüfbare Regeln aus dem Audit - Builder
