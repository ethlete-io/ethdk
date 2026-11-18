# Studio – Warteschlange, Rest

Fortsetzung der Warteschlange in [STATUS.md](STATUS.md), eine Liste (ADR 0351, 0354).

### Warteschlange, Rest

16. **B160** ⏳ Neu gezeichneter vorhandener Interaktionszustand: Vergleich auf Element-Ebene - Builder
17. **B422** ⏳ `lint:no-verify-briefs` prüft nur getrackte Dateien, NEGATED bekommt „no“, umbrochene ... - Builder
18. **B424** ⏳ Studio-Prüfungen laufen live in Studio und schnell, nie in Git-Hooks oder CI; Drift wird ... - Builder
19. **B477** ⏳ UI-Fehler, nur Mac: Text in `button.et-surface-interactive` auf elements/canvas-frames ... - Builder
20. **B480** ⏳ Tagschicht (ADR 0239): Spike CEF auf Windows wie B469 (Build läuft, Live-Frames, ... - Builder
21. **B482** ⏳ Release-Smoke: das Release-Bundle von Studio einmal starten, ein Sketch öffnen und bei ... - Builder
22. **B490** ⏳ Tagschicht: Design-Styles liefern eine Monospace- und die UI-Schrift selbst (ADR 0262, ... - Linux 210235327; Mac offen
23. **B508** ⏳ SDK (fifagg, ADR 0297), nach B507 + Breadcrumb-Tokens: Menüpunkt-Ladezustand; ... - Builder
24. **B255** ⏳ Part-Baum: Sketch-Titel nennt Variante, Regel, Meldung; Produkt-Probleme hängen am Part ... - Builder
25. **B256** ⏳ Veraltetes dist der Design-Mocks ist Problem: check/ready/shot lehnen ab mit ... - Builder
26. **B257** ⏳ Sketch sdk switch: Rahmen der leeren Spur ja/nein; danach entfällt switchStyles in inbox ... - Builder
27. **B266** ⏳ Probleme NESTED-SURFACE, LOST-SURFACE, PART-REWRITE; Sketch eines Parts mit Hosts shootet ... - Builder
28. **B268** ⏳ motion-shot.ts setzt settleFrames ein (Animationen auch in eingebetteten Frames beenden), ... - Builder
29. **B270** ⏳ e2e-check druckt Last und Kerne; Timing-Fall über Kernzahl rot → NOT MEASURED statt FAIL ... - Builder
30. **B274** ⏳ sketch rebase trägt reine Deklarations-Änderungen eines Parts (controls, motions, states) ... - Builder
31. **B275** ⏳ Problem UNSKETCHED-UI: App-Template-Diff fügt sichtbares Element ohne gewählten ... - Builder
32. **B264b** ⏳ Motions-Hinweis auch in design check/part-check: Text nach open-points.ts verschieben ... - Builder
33. **B276** ⏳ Part ohne implements, dessen Name eine App-Komponente trifft → Problem mit Pfad; Treffer ... - Builder
34. **B277** ⏳ sketch check/ready laden Frames über dieselbe Queue (gleiches N) wie Studio; Mutation N ... - Builder
35. **B278** ⏳ capability-place.spec rot auf echten Daten: comment-write emit:send vs pages/inbox ... - Builder
36. **B279** ⏳ Regel SKIP-UNUSED: data-et-skip ohne unterdrücktes Problem in jedem Zustand ist Problem; ... - Builder
37. **B283** ⏳ compare an einer Eltern-Revision: unterstützter Weg über den e2e-check-Baum (eigene ... - Builder
38. **B284** ⏳ Sketch-Shot zeichnet genau die Frame-Menge der Studio-Ansicht (eine Listenfunktion, Spec ... - Builder
39. **B289** ⏳ system-page: commentMode, draft, send, reason von KNOWN_UNBOUND_INPUTS nehmen und binden ... - Builder
40. **B291** ⏳ Push 04.11. ohne Hooks (Tom): Pre-Push-Hook auf 0ddbcc120 nachholen, Funde beheben; ... - Builder
41. **B295** ⏳ Studio-Prüfungen aus dem Pre-Push in Studios Prüfsystem (Specs, Design-Check, Live-Check, ... - Builder
42. **B296** ⏳ Jeder vom Server gemeldete Part-Fehler sperrt die Wahl über einen Pfad, nicht je Ansicht ... - Builder
43. **B299** ⏳ e2e-check.spec bekommt die sha vom Hook (env/arg), läuft im Pre-commit-Index-Checkout ... - Builder
44. **B300** ⏳ Regel TEXT-TRUNCATED: abgeschnittener Inhaltstext pro State ist ein Befund; Opt-out ... - Builder
45. **B301** ⏳ Stale-dist-Hash nur über committete Quellen (HEAD-Blobs); Agent-Briefs verbieten Edits an ... - Builder
46. **B302** ⏳ Ein maschinenweiter Lock für schwere Läufe (Pre-Commit-Specs, nx test, design check); ... - Builder
47. **B303** ⏳ Studio-Status nennt die Startphase ("CLI wird gebaut") mit Laufzeit (Bef. 355) - Builder
48. **B304** ⏳ macOS-Ampel vertikal in der Titelleiste zentrieren + Fensterprüfung (Bef. 357) - Builder
49. **B306** ⏳ Fehlgeschlagener Shot: Fehlerzustand statt kaputtem Bild; kein "Nichts offen" bei ... - Builder
50. **B307** ⏳ Parser-Specs für Tool-Ausgabe mit echten CI-Logs als Fixture (Bef. 360) - Builder
51. **B308** ⏳ Prüfung auf Personennamen in libs/, apps/, apps/docs, .ethlete/design; Rolle "human" ... - Builder
52. **B310** ⏳ Studio-Freeze: WebKit-Bug bei Top-Level-Await + Iframe-Entfernen; TLA raus, TLA-Guard, ... - Builder
53. **B311** ⏳ Leere Frames: WKWebView schließt SSE nach 60 s ohne Bytes, Reconnect remountet alles, ... - Builder
54. **B312** ⏳ Overscroll der Shell: overscroll-behavior none überall (de2b83743); Scroll-Kanten-Probe ... - Builder
55. **B313** ⏳ Frames über dem Explorer unter Last: isolate + contain-paint am Canvas (de2b83743); ... - Builder
56. **B315** ⏳ Neu-starten-Klick tötet Server bei dirty libs/cli: Neustart nur aus Commit-Kopie ... - Builder
57. **B317** ⏳ Erstes Listing langsam: Regel-Checks blockieren den Server, Abbruch nur im Client; Worker ... - Builder
58. **B319** ⏳ Leerer Direct-edit-Sketch: Ziel als Part-Key, old mit neuem shared/, englische Texte; ... - Builder
59. **B332** ⏳ Design-Check-Regel: löst die Imports jeder Sketch-Variante auf, damit ein veraltetes ... - Builder
60. **B335** 🔨 CI prüft den gepushten Bereich: commitlint + `yarn test:tools`; Pre-push prüft commitlint ... - Builder
61. **B337** ⏳ Design-Server meldet fehlendes dist statt zu hängen; verify-webkit-studio prüft ... - Builder
62. **B340** ⏳ Triage `design check --product studio`: 698 Funde, Exit 1 (DROPPED-PROP 11, LOST-SURFACE ... - Builder
63. **B342** ⏳ `sketch check`: Variante mit geänderten unberührten Zuständen ist Fehler; `sketch ... - Builder
64. **B344** ⏳ `sketch rebase` nach einer Wahl portiert nur die gewählte Variante; zwei offene Sketches ... - Builder
65. **B349** ⏳ Merge startet die e2e-Fälle des gemergten Parts; 3 Fälle rot nach den Merges vom 04.11. ... - Builder
66. **B350** ⏳ `/__design/system`: kalt ~60 s Wartezeit, warm Stall 1 s (Mac); kalt < 5 s, warm < 200 ... - Builder
67. **B365** ⏳ Explorer: Mausrad über Tree-Item-Innenfläche scrollt spät; Messung in CEF (Zeile vs. ... - Builder
68. **B375** ⏳ `design check`: `components/scheduler` braucht 120 s (vermutlich Render-Timeout), 18 % ... - Builder
69. **B376** ⏳ Commit-Hook braucht ~100 s (`vitest related` + Typecheck): messen, wo die Zeit hingeht, ... - Builder
70. **B378** ⏳ e2e-Biss: der Harness nimmt für einen Biss-Lauf `STUDIO_CLI_ENTRY` aus einer alten ... - Builder
71. **B381** ⏳ SDK: native `title` dort, wo ein `aria-label` passt, prüfen (Passwort-Feld, PiP, ... - Builder
72. **B386** ⏳ pre-commit-Gate: Datendateien (`migrations.json`, `generators.json`) auf die Specs ... - SDK-Session ethlete-sdk-ff
73. **B388** ⏳ Voller `design check --product studio`: ~800 Render-Probleme sortieren (echte Fehler oder ... - Builder
74. **B391** ⏳ Zwei Studio-e2e-Fälle flaky nur im vollen Lauf: Live-Frame-Limit nach Abstand zur Ansicht ... - Builder
75. **B398** 🔨 UI-Builder (zweite Session) baut die UI-Liste: A1 gebaut ff698951f; title-bar@notice-hint ... - Builder (c8)
76. **B399** 🔨 Performance zuerst: `design compare` (Bef. 477), sketch ready/check, C1 ... - Builder (c0)
77. **B401** 🔨 Neue Design-Regel läuft im eigenen Commit über alle Produkte; alte Treffer in eine ... - SDK-Builder (cb)
78. **B403** 🔨 UI-Builder untersucht nur Werkzeuglücken, die ihn blockieren; alle anderen in einem Satz ... - Builder (c8)
79. **B404** 🔨 Design-Hintergrundprozess (Bef. 492, 493): S1 Lib-Build-Sperre, S2 Prozess + Client + ... - Builder (c0)
80. **B405** 🔨 Alte Implementierungs-Drift (sketches, system, canvas-frames) in schrumpfende Baseline ... - cb, dann c8
81. **B406** 📋 Skizzen-Merge prüft in sauberer Kopie von HEAD + nur der Skizze; fremde ungespeicherte ... - cb
82. **B410** 📋 DROPPED-PROP-Baseline abbauen: je eine Skizze für canvas-frames, pages/sketches, ... - c0
83. **B412** 📋 Veralteter merged-Hash: Regel DIRECT-EDIT-PENDING für gemergte Teile, deren Hash ohne ... - c0
84. **B413** 📋 Regel ACCESSIBLE-NAME: zugänglicher Name eines Controls Design vs. App vergleichen; ... - c0
85. **B414** 📋 Resident-e2e-Spec: echter Hintergrundprozess, compare, Part ändern, compare erneut - ... - c0
86. **B416** 📋 compare schneller (Bef. 521): App-Shots parallel, S4 Bild-Cache vorziehen, mehrere Parts ... - c0
87. **B370** ⏳ Studio-Host endet bei Ctrl+C/SIGTERM: erst Beweis an zweiter Debug-Instanz, dann Host-e2e ... - Builder
88. **B368** ⏳ `et design`: Serve-Zustand zeigt Besitzer des Ports (Studio-App oder Terminal), bedienten ... - Builder
89. **B356** ⏳ Zoom in WebKit ~20 fps (Chromium 60): WebKit-Budget Frame-Intervall p50 ≤ 20 ms, p95 ≤ 33 ... - Builder
90. **B100** ⏳ Restliche prüfbare Regeln aus dem Audit - Builder
