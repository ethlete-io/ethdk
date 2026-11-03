# Studio – Status

Stand: 02.11.2026, abends

## Ziel

Das MVP ist erreicht (02.11.): alle 17 Studio-Teile sehen im Code so aus wie ihr gemergter Entwurf und sind „fertig“.
Jetzt kommen die Themen für nach dem MVP. Sie stehen unten in fünf Listen (A bis E). Jeder Eintrag hat eine feste ID (zum Beispiel B21);
erledigte Einträge werden gelöscht, die IDs der anderen bleiben. Die Quelle (Befund oder Q) steht in `design-to-code.md`, „dl“ heißt
`backlog-parallel/decisions-latest.md`.

## Regeln

1. Jedes Ding gibt es nur einmal: ein Canvas, ein Picker, keine Kopien.
2. Jeder Fehler wird zuerst ein Test, dann wird er behoben.
3. Werkzeug-Fixes sind allgemein: sie helfen jedem Projekt, nicht nur Studio.
4. Ein Produkt-Thema (Liste A) startet erst, wenn Tom seine Reihenfolge festgelegt hat. Braucht es einen Entwurf, kommt
   zuerst der Entwurf (Liste E).
5. Der Builder wartet nicht auf Tom. Tom bekommt eine kurze Runde, wenn er da ist: höchstens 3 Fragen.

## Gerade in Arbeit

Stand der aktuellen Welle. ✅ fertig (lokal, ungepusht), 🔨 läuft, ⏳ geplant, ⛔ hakt, ⏸️ geparkt. Die Grill-Session hält die
Tabelle nach jedem Bericht des Builders aktuell; fertige Zeilen fallen beim Push weg.

**Priorität (Tom, 02.11. 11:00): zuerst die Sketch-Ansicht** (pages/sketches r2, Variante e: B34, B36, B38, B84,
A13). Laufende Slices enden nur committbar; neue Tool-Fixes werden notiert, aber nicht gebaut, außer sie blockieren
die Sketch-Ansicht.

| ID                | Was                                                                                                                                                                                      | Stand | Was fehlt / wo es hakt                                                                                                                                                                                                                                               | Wer     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Sketch-Ansicht    | Bau von pages/sketches, Variante e (Zeilen je Variante)                                                                                                                                  | ✅    | 5a29b1b94 (Variante a gemergt); Compare 8/9, drawing 70 px Puls-Rauschen (B117); task --verify + ready folgen                                                                                                                                                        | Builder |
| Sketch-Folgerunde | Fit = Aktuell + 1. Variante, "vergleicht ...", Namen kleben links, Kopf skaliert unter Fit, Akkordeon für unveränderte Varianten, Badge nach echtem Zustand (Bef. 205-207)               | 🔨    | App-Slice gebaut, ungecommittet; Compare 7 ok, 12 DIFF, 2 FAILED; „Pausiert“ ohne Daten (Bef. 234)                                                                                                                                                                   | Builder |
| Push `next`       | Alles seit 062bca6f3                                                                                                                                                                     | ⛔    | Zuerst B87-Nachtrag (go.json-Regel enger), dann Pre-push und Push                                                                                                                                                                                                    | Builder |
| title-bar         | Titelleiste mit Suchfeld, Go 02.11.                                                                                                                                                      | ✅    | Compare grün                                                                                                                                                                                                                                                         | -       |
| title-search      | Suchfeld der Titelleiste, Go 02.11.                                                                                                                                                      | ⛔    | Compare 1 px zu hoch, Ursache im Harness; nach B105 neu vergleichen                                                                                                                                                                                                  | Builder |
| shell-main        | Shell mit Titelleiste (B76)                                                                                                                                                              | 🔨    | Neues Go 10:58; Compare steht aus                                                                                                                                                                                                                                    | Builder |
| update-dialog     | Update-Dialog, Go 02.11.                                                                                                                                                                 | ⛔    | Harness rendert jetzt (89d94b1bc); Design 400 px hoch, App 96 px: Ursache offen                                                                                                                                                                                      | Builder |
| B97               | Sketches ohne Auswahl, kein Fokusring nach Fensterwechsel (Bef. 158)                                                                                                                     | ✅    | 849f2792c; Tom prüft den Ring in der echten App (Headless kann es nicht)                                                                                                                                                                                             | Tom     |
| B101              | Beweis auf dem echten Pfad für B69/B94 (Bef. 174)                                                                                                                                        | 🔨    | Rebuild echt bewiesen, e2e rot/grün; fehlt: echter Shot mit `--states` danach                                                                                                                                                                                        | Builder |
| B102              | Builder schweigt (Bef. 175)                                                                                                                                                              | ⏳    | Hook eingetragen (3326a7670); `--role builder` erst beim nächsten Prozessstart (Tom: jetzt kein Neustart)                                                                                                                                                            | Tom     |
| B105              | Harness misst ohne eigene Größe (Bef. 178)                                                                                                                                               | ⏸️    | 7a9071c3f zurückgenommen (b3e5da3ef); neu nur, wenn die Sketch-Ansicht es braucht                                                                                                                                                                                    | Builder |
| B106              | Keine Interaktionszeilen für unveränderte eingebettete Parts                                                                                                                             | ✅    | 28dbab036; Lücke: Part-CSS auf einem schlichten SDK-Element zählt nicht als Styling                                                                                                                                                                                  | -       |
| B107              | Skizzen zoom-chip (reset) und shell-main (section + product)                                                                                                                             | ✅    | zoom-chip a (82d60597c); shell-main-Skizze von Tom verworfen (02.11.), Parts shell-section/-product ohne Skizze folgen                                                                                                                                               | Builder |
| B108              | UNUSED-PART-STYLES, kein Teal-Fallback, toter studio-mark weg; Logo-Fix in d/e/f                                                                                                         | ⏸️    | -                                                                                                                                                                                                                                                                    | Builder |
| B109              | Sketch zeigt, welcher Agent eine Variante gezeichnet hat (Bef. 180)                                                                                                                      | ⏸️    | -                                                                                                                                                                                                                                                                    | Builder |
| B110              | `sketch withdraw`, `--by` streng, ready nennt Agent-Aktion (Bef. 184/186)                                                                                                                | ✅    | 01238d765; Skill-Satz trägt Tom später ein (agent-rules design-exploration l.91); Studio zeigt withdrawn als rejected                                                                                                                                                | -       |
| B111              | HIDDEN-CONTENT (Canvas ausgenommen), Live-Compare misst Regionen, Ähnlichkeitsprüfung der Varianten (Bef. 181/182/185)                                                                   | ⏳    | nach der Sketch-Ansicht                                                                                                                                                                                                                                              | Builder |
| B112              | Kanonische Tailwind-Klassen in `design check` (Bef. 183)                                                                                                                                 | ⏳    | nach der Sketch-Ansicht                                                                                                                                                                                                                                              | Builder |
| B113              | Unsichtbare Änderung behält das Go (Entscheidung „Go last“ Punkt 2; Bef. 190)                                                                                                            | ⏳    | nach der Sketch-Ansicht; dazu ready: ungenutzte Exporte in shared/ aufräumen                                                                                                                                                                                         | Builder |
| B114              | Notizsprache: Vorlage nennt Produktsprache, NOTE-LANGUAGE-Warnung, `sketch note --round` (Bef. 194)                                                                                      | ⏳    | Varianten-Notizen deutsch (5df2ad7da); Rundennotiz r1 erst mit `--round`; nach der Sketch-Ansicht                                                                                                                                                                    | Builder |
| B115              | Pre-commit `vitest related` für gestagte Studio-Dateien; `nx test` zeigt den Fehler (Bef. 204)                                                                                           | ⏳    | Code-Fix `content.body?.` dazu                                                                                                                                                                                                                                       | Builder |
| B116              | part-accept.spec eigenes testTimeout (~30 s); Pre-commit `vitest related` auch für libs/cli (Bef. 209)                                                                                   | ✅    | 7bc1ad21f; Blockieren bei roter cli-Spec im Worktree bewiesen                                                                                                                                                                                                        | Builder |
| B117              | Compare nennt Versatz und Fit-Skala, friert animate-* ein; task listet fehlende data-sk-Marker (Bef. 210)                                                                                | ✅    | d4cd2c8b3; Endlos-Animationen auf der Design-Seite angehalten, Compare 5a29b1b94 9/9                                                                                                                                                                                 | Builder |
| B118              | ng()-CSS in drawing.styles statt erstem Render; Check meldet SDK-Komponente ohne CSS (Bef. 211)                                                                                          | ✅    | af28afe38; UNSTYLED-SDK rot auf altem Build (16), Go pages/sketches bleibt gültig                                                                                                                                                                                    | Builder |
| B119              | CONTROL-STATE: SDK-Variante nur wenn sie den Look erreicht, sonst Part ohne Skizze mit Begründung                                                                                        | ⏳    | Hinweistext + Begründung im Check sichtbar                                                                                                                                                                                                                           | Builder |
| B120              | Sidebar zu/auf verschiebt den Canvas nicht; e2e-Fall (Bef. 212)                                                                                                                          | ⏳    | Kamera um Ursprungs-Delta verschieben                                                                                                                                                                                                                                | Builder |
| B121              | Seitenwechsel ohne Sprung: Fenster-Chrome einmal beim Start, e2e misst Layout nach Navigation (Bef. 213)                                                                                 | ✅    | fb434b68b; page-switch.e2e rot 1/4 vorher, grün 4/4                                                                                                                                                                                                                  | Builder |
| B122              | Pre-commit-Hook unter `git commit -- <paths>` getestet (Bef. 214)                                                                                                                        | ⏳    | GIT_INDEX_FILE-Leck in af28afe38 behoben, Spec fehlt                                                                                                                                                                                                                 | Builder |
| B123              | Check warnt vor uncommitteten Studio-Entscheidungen; `design check <part>` respektiert den Part (Bef. 216)                                                                               | ✅    | 66f1acb49; Warnung pro Produkt, Positional-Part = --part; echter Lauf nach B117-Rebuild offen                                                                                                                                                                        | Builder |
| B124              | Auto-Go: `by` = Tool + carriedFrom statt Toms Name (Bef. 217)                                                                                                                            | ⏳    | Tom: ja (by: Tool + carriedFrom), inkl. Migration bestehender auto-Einträge                                                                                                                                                                                          | Tom     |
| B125              | task --verify: Exit 1 bei Ablehnung, Design-Dateien ausgenommen, Wiring-Dateien erlaubt (Bef. 218)                                                                                       | ✅    | e07475c08; Exit 1 war schon da, Spec sichert es; 5a29b1b94 scheitert nur noch an Compare (B117)                                                                                                                                                                      | Builder |
| B126              | Hook für lange Design-Befehle prüft nur den Befehlskopf, nicht Commit-Texte (Bef. 219)                                                                                                   | ⏳    | niedrig                                                                                                                                                                                                                                                              | Builder |
| B127              | Neue data-et-skip-Marker einer Skizze in sketch ready und im Studio-Rundenkopf zeigen (Bef. 220)                                                                                         | ⏳    | nach der Sketch-Ansicht                                                                                                                                                                                                                                              | Builder |
| B128              | Wiring = alle App-Dateien, die den Part transitiv importieren; nicht über Spec-Importe (Bef. 221)                                                                                        | ✅    | 7957d3194 + 1d932a5c9 (Importe der direkten Importer, Bef. 224); echter verify-Lauf offen                                                                                                                                                                            | Builder |
| B129              | Action-Check: deklarierte Host-Komponenten (DesignCanvas) zählen als Chrome, eine Zeile „not checked“ (Bef. 222)                                                                         | ✅    | a248eacd2 + 56aabfd95; harness.hosts = [DesignCanvas]                                                                                                                                                                                                                | Builder |
| B130              | Check meldet interaktive Design-Elemente ohne data-et-action schon beim Zeichnen; holdTrigger bekommt Marker (Bef. 222)                                                                  | ✅    | 5577108ff + d2d484c55; Go pages/sketches veraltet, PICTURES CHANGED drawing klären                                                                                                                                                                                   | Builder |
| B131              | compare auf Part mit Go führt den Action-Check mit aus (Bef. 222)                                                                                                                        | ✅    | 05bd3d18a; Compare pages/sketches: 4 Tastatur-Misses am Pausiert-Button (B136)                                                                                                                                                                                       | Builder |
| B132              | Pre-commit: Related-Map für Specs, die Quellen per Pfad/Text laden; Lint verlangt den Eintrag; CI läuft volle CLI-Suite (Bef. 223)                                                       | ✅    | f25290568; libs/cli/related-map.json + yarn lint:cli-related-map in pre-push/CI                                                                                                                                                                                      | Builder |
| B133              | ACTION-UNDECLARED als Ratsche: Fehler nur für neue/geänderte Parts und Skizzen, sonst eine Warnzeile pro Part (Bef. 225)                                                                 | ✅    | 3be274358                                                                                                                                                                                                                                                            | Builder |
| B134              | Studio: Aktionen in comment-pin, title-bar, tree-row, update-dialog deklarieren; Gos danach gesammelt neu (Bef. 225)                                                                     | ✅    | 4bbd88e03; ACTION-UNDECLARED 0; Gos von 4 Parts veraltet (Tom gibt neu Go)                                                                                                                                                                                           | Builder |
| B135              | SDK: explizite Deklaration „Part ist Control, Aktion gehört dem Nutzer“, dann Rest-Treffer (Bef. 225)                                                                                    | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B136              | Pausiert-Button: Enter/Space erreicht paused-reason nicht (Klick schon); Ursache App oder Check, roter Test zuerst                                                                       | ✅    | b1f5d4e68; Tool-Bug, Fokusring vor Ziel-Vergleich entfernt                                                                                                                                                                                                           | Builder |
| B137              | CI-Checks-Job führt die node --test-Specs unter tools/scripts aus (heute läuft keiner davon)                                                                                             | ✅    | db0eedd1b; yarn test:tools in CI Checks + pre-push                                                                                                                                                                                                                   | Builder |
| B138              | Check lehnt Design-Commit auf Part mit offener Skizze ab, wenn die Skizze nicht im selben Commit rebased wird (Bef. 226)                                                                 | ✅    | 7b6e79545; Lücke: gewählte veraltete Skizze wird nicht gemeldet (B144)                                                                                                                                                                                               | Builder |
| B139              | Studio committet go.json bei „Go geben“ (ein Commit pro Go, Autor Tom); heutige Gos einmalig gesammelt (Bef. 219)                                                                        | ⏳    | Tom: ja; bis dahin liegen go.json/merged.json/pictures.json bei Tom (r2-Merge 610ca0da1)                                                                                                                                                                             | Builder |
| B140              | CUT-CONTROL (abgeschnittenes interaktives Element ist Fehler, Skip schaltet es nicht ab) + Skip-Scope (CLIPPED nicht auf Vorfahren interaktiver Elemente) (Bef. 228)                     | 🔨    | rote Tests zuerst; Sketches-Wurzel-Skip nach dem App-Slice                                                                                                                                                                                                           | Builder |
| B141              | studio-lab UTILITY-CSS (23), damit der Check über alle Produkte grün wird                                                                                                                | ✅    | 4a917bcf5; Pixel unbelegt (studio-lab hat keine fertigen Parts); Skizzen-Rebase button/card läuft                                                                                                                                                                    | Builder |
| B143              | Pre-commit testet den Index, nicht den Arbeitsbaum (Bef. 230)                                                                                                                            | ✅    | f93354921; +3-5 s; Rest: pre-push auf gemeinsamen Helper umstellen                                                                                                                                                                                                   | Builder |
| B144              | SKETCH-BASE-STALE auch für gewählte Skizzen, bevor Tom mergt                                                                                                                             | ✅    | 4c3522b13 + cea79537a; Zeile nennt `yarn design sketch rebase`                                                                                                                                                                                                       | Builder |
| B145              | Kommentarknopf zurück: Skizze mit einer Variante oben rechts bei den anderen Knöpfen, dann Bau; danach Skizze „wo gehören Seitenknöpfe hin“ mit Varianten (Bef. 231)                     | 🔨    | Schritt 2: 9e5ec0e23 (Entwurf gezeichnet) + 4221e7cb3 (live); Compare pages/system 13/13 bei 0 px; red-check rot; offen: echtes Senden, Fadenkreuz-Klick, Esc live; ready/go wartet auf Toms uncommittete go/merged-Dateien                                          | Builder |
| B146              | ACTION-LOST: verschwundene Nutzer-Aktion macht den Check rot, bis Tom bestätigt (Bef. 231)                                                                                               | ✅    | fe528affc + e8a7ab2eb; go speichert Aktionen je Part; Entfernen bestätigen = neues Go; alte Gos ohne Aktionen übersprungen                                                                                                                                           | Builder |
| B147              | ORPHAN-ENDPOINT: jeder von der CLI bediente Studio-API-Pfad braucht einen Aufrufer in der App (Bef. 231)                                                                                 | ✅    | a028e8707 + bb4d73606; 15 Treffer in studio; bekannte Waisen als Ratschen-Liste (nur schrumpfen)                                                                                                                                                                     | Builder |
| B148              | Notizen schreiben wieder möglich (Schreibweg seit 8cf715654 weg, wie Kommentare) (Bef. 231)                                                                                              | ⏸️    | Tom: später, nach B145                                                                                                                                                                                                                                               | Builder |
| B149              | studio-lab film-detail reviewing: Kontrast 2.07:1 -> Skizze mit einer Variante, Text-Token auf AA (Bef. 232)                                                                             | ⏳    | b637b6259 ready: Platzhalter auf --lab-surface (~15.5:1, aus Hex gerechnet); Tom wählt in Studio                                                                                                                                                                     | Tom     |
| B150              | Render-Check läuft auch bei rotem statischem Check; sonst „nicht geprüft“ mit Parts (Bef. 232)                                                                                           | ✅    | 9ac743bc0; NOT CHECKED je Part + ohne Browser; 14 ORPHAN-Warnungen verdrahtet; rot belegt                                                                                                                                                                            | Builder |
| B156              | Related-Map: lib-weite Specs (studio-api-level) laufen bei jeder cli-Quelländerung mit (Bef. 236)                                                                                        | ✅    | 2666cc517; `sourceWide`-Liste in related-map.json                                                                                                                                                                                                                    | Builder |
| B151              | Verwaiste Endpunkte sketch-diff, sketch-crop, motion, part-ready: Aufrufer zurück oder Endpunkt weg (Bef. 231)                                                                           | ✅    | ef36b501b Waisen-Liste (14, nur schrumpfen) + 8dbbbc32c part-ready weg; Warnzeilen kommen mit B150; Fähigkeiten-Einträge mit B157                                                                                                                                    | Builder |
| B157              | Fähigkeiten-Liste je Produkt; `design check` meldet Fähigkeiten ohne Design-Aktion (Bef. 231)                                                                                            | 🔨    | 572dfe27b: 65 bestätigt, 24 mit missing (B145/B148/B151/B173-B178); Verdrahtung + Doku läuft nach B169                                                                                                                                                               | Builder |
| B158              | COVERED/UNREACHABLE: erklärte Aktion muss in jedem Zustand erreichbar sein (verdeckt, versteckt, Größe 0) (Bef. 237, 242)                                                                | 🔨    | c0e804c46: COVERED/UNREACHABLE im Render-Check, red-check rot; echte Treffer in pages/sketches (sticky-names, zoomed-page, unchanged-matrix-open; far-out pinToggle); Übernehmen/Verwerfen erst nach B181 prüfbar                                                    | Builder |
| B159              | Render-Check: GRID- und CONTRAST-Ausnahmen gegen die gemergte Definition filtern (wie B152)                                                                                              | ⏳    | Backlog, technisch                                                                                                                                                                                                                                                   | Builder |
| B160              | Neu gezeichneter vorhandener Interaktionszustand: Vergleich auf Element-Ebene                                                                                                            | ⏳    | Backlog, erst bei echtem Fall                                                                                                                                                                                                                                        | Builder |
| B161              | `red-check`: neue Specs müssen gegen den alten Code rot sein, per Skript belegt (Bef. 238)                                                                                               | ✅    | b39457700 + 53a963fe9: LOAD-ONLY zählt nicht, Auto-Stubs; B152 (6), B155 (4), B156 (2) rot belegt                                                                                                                                                                    | Builder |
| B162              | `sketch ready` merkt sich den geprüften Inhalt; geänderte Variante fällt auf „in Arbeit“ zurück (Bef. 239)                                                                               | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B163              | `design shot --crop` außerhalb des Inhalts schlägt fehl statt leer (Bef. 240)                                                                                                            | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B164              | Disclosure-Demo mit eigenem Block-Body, damit Compare Panel- vs. Body-Padding unterscheidet (Bef. 241)                                                                                   | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B165              | Unbekannte Modell-ID im Pausiert-Hinweis: neutrales Ersatz-Logo statt Claude                                                                                                             | ⏳    | Backlog                                                                                                                                                                                                                                                              | Builder |
| B166              | App-Titelleiste, Update-Dialog, Baumzeile melden Aktionen als Outputs; Aufrufer ruft Fenster-API (Bef. 242)                                                                              | ✅    | 1da209894; tree-row + title-bar: jede Aktion wirkt; update-dialog-Rest = B179                                                                                                                                                                                        | Builder |
| B167              | Windows-Titelleiste sieht nach Windows aus (breite Caption-Buttons, volle Höhe, bündig): Skizze (Bef. 243)                                                                               | 🔨    | r2: Tom (e, 46 px): Kachelgröße richtig, Icons zu klein (Tinte ~6 statt 10 px, Bef. 247) -> r3 mit Glyph-Größen als Varianten                                                                                                                                        | Builder |
| B168              | Plattform-Maße einer OS-Imitation im Part erklärt und vom Check gemessen (Bef. 243)                                                                                                      | ⏳    | nach B158 und Toms r3-Wahl; misst Glyphen als Tinte, nicht als Box (Bef. 247)                                                                                                                                                                                        | Builder |
| B169              | NOT CHECKED je Zustand: ein nicht gezeichneter Zustand fällt nie still durch (sketches unchanged-matrix)                                                                                 | 🔨    | läuft (ein Agent mit CAPABILITY-PLACE, check-system.ts, zwei Commits)                                                                                                                                                                                                | Builder |
| B170              | Render-Issue trägt Flag „nicht gezeichnet“ statt Textvergleich                                                                                                                           | ⏳    | Backlog, technisch                                                                                                                                                                                                                                                   | Builder |
| B171              | `design shot` nimmt jeden gerenderten Interaktionszustand an, nicht nur die erste Zeile (Bef. 243)                                                                                       | ✅    | 327bd8362 + Doku db1ac40c5; jeder definierte Zustand per Name schießbar; red-check rot; echt belegt (windows-hover/focus-visible/update-hover aus dem gemergten title-bar)                                                                                           | Builder |
| B172              | `sketch check` überspringt zurückgezogene Varianten (höchstens NOTE)                                                                                                                     | ✅    | 527d46fba + Doku db1ac40c5; zurückgezogene Varianten nur NOTE; red-check rot; nur mit gemocktem Render belegt                                                                                                                                                        | Builder |
| B173              | `data-et-action` an gezeichneten Knöpfen: Kommentar senden (pages/inbox), Inventory freigeben/neu laden/umschalten (Bef. 231)                                                            | ⏳    | entschieden, technisch; nach B181 (berührt alle Designs); Inbox-Senden auch in der App verdrahten                                                                                                                                                                    | Builder |
| B174              | pages/inbox: Kommentare erneut laden zeichnen (Bef. 231)                                                                                                                                 | ⛔    | a82322591 Skizze; blockiert durch LIVE-Fehlalarm (B183)                                                                                                                                                                                                              | Builder |
| B175              | pages/system: Go geben, Änderung annehmen, Ausnahme freigeben, Auftrag übertragen, Theme wählen zeichnen (Bef. 231)                                                                      | 🔨    | bbbda5227 Skizze r1 (a Toolbar wie App, b im Offene-Punkte-Popover); Builder empfiehlt a; Tom wählt im Studio                                                                                                                                                        | Builder |
| B176              | pages/sketches: Runde wählen zeichnen (Bef. 231)                                                                                                                                         | ✅    | e9da0d22c emit:roundChange; auto-gemergt 880826a33, Places 2530e823f; keine Pixeländerung                                                                                                                                                                            | Builder |
| B177              | pages/flows: Viewport wählen, Prompt kopieren zeichnen (Bef. 231)                                                                                                                        | ✅    | 085c702d7 emit:presetChange + emit:copyPrompt; auto-gemergt 880826a33, Places 2530e823f; keine Pixeländerung                                                                                                                                                         | Builder |
| B178              | Canvas: Frame wählen, Größe ändern, Raster umschalten, Frame neu laden zeichnen (Bef. 231)                                                                                               | ⏳    | Skizze, Tom wählt                                                                                                                                                                                                                                                    | Builder |
| B179              | Compare prüft erklärte Aktionen nur im eigenen Teilbaum, eingebettete Parts prüfen sich selbst; „host DesignCanvas: not checked“ klären (Bef. 231)                                       | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B180              | `design shot` nimmt `--state` allein und `--out` mit `--variants`; `sketch check` überspringt auch abgelehnte Varianten; Usage-Ablehnung nennt die Flags (Bef. 244)                      | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B181              | `withAction(markup, action)` wirft, wenn nichts markiert wurde; pages/sketches merge/discard tragen ihre Aktion wirklich (Bef. 245)                                                      | ⏳    | entschieden, technisch; danach rot auf den Übernehmen-Fällen                                                                                                                                                                                                         | Builder |
| B182              | Specs rendern echte Studio-Parts (Render-Worker im vitest-Setup gebaut); RENDER zeigt den ganzen Fehler (Bef. 246)                                                                       | ⏳    | entschieden, technisch; Ursache mit „Transform failed“ (B169-Slice) abgleichen                                                                                                                                                                                       | Builder |
| B183              | LIVE-Check liest Zustandsnamen aus dem geladenen Modul, nicht aus einem `states: {}`-Literal (Bef. 248)                                                                                  | 🔨    | läuft; danach B174 ready + Place „Erneut laden“                                                                                                                                                                                                                      | Builder |
| B184              | `design commit-hunks <file> --part <p>`; `sketch ready` nennt den Befehl je geschriebener Datei; Brief nutzt ihn (Bef. 249)                                                              | ⏳    | entschieden, technisch; kein Auto-Commit in ready; nach B180 (sketch-command.ts)                                                                                                                                                                                     | Builder |
| B185              | `sketch new --name`: zwei Skizzen auf einem Part kollidieren nicht (Bef. 250)                                                                                                            | ⏳    | entschieden, technisch; nach B180 (sketch-command.ts)                                                                                                                                                                                                                | Builder |
| B186              | Sketches-Canvas wieder frei beweglich: Pan endet nicht mehr oben links (Regression nach Bef. 191, Tom 2026-11-03)                                                                        | 🔨    | Ursache beim Builder angefragt; Verdacht 030fe2f36                                                                                                                                                                                                                   | Builder |
| B187              | `data-et-skip=CLIPPED` auf dem geclippten Inhalt statt auf der Canvas-Viewport-Wurzel (Bef. 251)                                                                                         | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B188              | Anchored-Dialog: Anker-Option für den Pfeil (SDK); Render-Check misst Pfeilspitze gegen Ankermitte (Bef. 252)                                                                            | ⏳    | entschieden, technisch; Changeset + Doku                                                                                                                                                                                                                             | Builder |
| B189              | Skizze Kommentar-Faden: geöffneter Pin als Karte in pages/system + pages/inbox (antworten, erledigen, zurückziehen), Entwurf fokussiert, Kommentarmodus per Esc/`C` verlassen (Bef. 253) | ⏳    | Skizze; nach B174 ready oder B185 (zwei Skizzen auf pages/inbox kollidieren); mit e2e Fadenkreuz + Esc; Tom wählt                                                                                                                                                    | Builder |
| B190              | ORPHAN-ENDPOINT löst Aufrufer über die Host-Funktionen auf, nicht per Text (Bef. 254)                                                                                                    | 🔨    | läuft (Sonnet-Agent, nur Regel-Dateien)                                                                                                                                                                                                                              | Builder |
| B152              | Sketch-Check zählt CONTROL-STATE-Lücken nur, wenn die Variante sie einführt; Sketch- und Product-Check urteilen gleich (Bef. 233)                                                        | ✅    | 87de26aff; „eingeführt“ nach Zustandsname; rot belegt (6 Tests am Vorgänger rot)                                                                                                                                                                                     | Builder |
| B153              | Compare nimmt jede Design-Prop an, die die Harness-Map verbraucht (`comparing`) (Bef. 234)                                                                                               | ✅    | e2644f6fa; Harness-Samples gelesen; rot belegt; model()-Abbildung (Bef. 241) läuft, danach Diff-Analyse comparing / unchanged-matrix-open                                                                                                                            | Builder |
| B154              | STATE-NO-SOURCE: jeder Design-Zustand eines implementierten Parts hat eine Datenquelle in der App (Bef. 234)                                                                             | ⏳    | entschieden, technisch                                                                                                                                                                                                                                               | Builder |
| B155              | UNBOUND-INPUT und SAMPLE-DEFAULT, als Ratsche (Bef. 234)                                                                                                                                 | ✅    | c86b80d1f: in `design check`; model()/model.required() zählen als Input; red-check rot; echt 0 Fehler, 29+11 bekannte Warnungen; +3 bekannt (shell-main projectPicker, merge unchanged, system-page closed); Render-Check im privaten Build offen (B169-Slice prüft) | Builder |
| B142              | Ein Canvas: Seiten nutzen den erklärten Canvas-Baustein, Check meldet eigene Schwenk-Kästen; Sketches-Clip an der Leistenkante weg, Kopf klebt (Bef. 228)                                | ⏳    | Tom: ja (03.11.); Sketches-Fix als Skizze mit einer Variante nach der App, wie umgesetzt                                                                                                                                                                             | Builder |
| Befund 161        | Sketches-Ansicht braucht nach Reload ~10 s                                                                                                                                               | 🔨    | -                                                                                                                                                                                                                                                                    | Builder |
| B100              | Restliche prüfbare Regeln aus dem Audit                                                                                                                                                  | ⏳    | -                                                                                                                                                                                                                                                                    | Builder |

Danach: B80, B81, B82, B71, B74, B78; Bau der Sketch-Ansicht Variante e, Code-Review B58, B57, B59, B60, A13 (CLI),
B62.

Bei Tom:

- B97 in der echten App prüfen: in Sketches in den Canvas klicken, Fenster wechseln und zurück - kein Ring.
- Nach der Sketch-Ansicht: Skizzen aus B107 (zoom-chip, shell-main) wählen und mergen.

Übergaben (lokal, per gitignore ausgeschlossen): `.claude/handoffs/doc-agent-studio.md`,
`.claude/handoffs/builder-studio.md`; geparkt: `b36-parked.patch` und `b36-parked-e2e.mjs` (B36, nach der Wahl von
pages/sketches, auf B34 aufgesetzt); Berichte unter `.claude/handoffs/agent-results/`.

Reihenfolge danach: Bau von pages/sketches r2 (B34, B36, B38, A13), B46, B43-B45, B39-B41; Liste A: A1, A36, A8, dann A9 und A10,
dann A5 bis A7 und A40, danach der Rest; A38 und A39 nach A37.

## Erledigt

MVP fertig (02.11.). Erledigte Einträge fliegen aus den Listen; die Historie steht in `git log -- plans/ethlete-studio/STATUS.md`.

## A. Studio: was man sieht

- **A1** Titelleiste: Sketch `components/title-bar` Variante C ist gemergt (02.11.); jetzt den Code angleichen
  (Fensterknöpfe, Suchfeld „studio / Part“, Update-Knopf nur bei bereitem Update; Befund 133).
- **A2** Nach A1: Suche in der Titelleiste; Klick oder Strg+K öffnet die Command Palette.
- **A3** Nach A1: Knopf „Update“ in der Titelleiste, nur wenn ein Update bereit ist (Q90).
- **A4** Arbeit (Rendern, Mergen) nur in der Ansicht zeigen, auf die man wartet.
- **A5** Seitenleiste: Repo-Wechsel und „Projekt öffnen“ ins Logo-Menü; oben die Auswahl der Design-Systeme; die Auswahl
  unten entfällt.
- **A6** Schnellwahl in der Leiste zeigt Logo oder zwei eindeutige Buchstaben, mit Tooltip (Q21).
- **A7** Breite der Seitenleiste mit der Maus ziehen (Q133).
- **A8** Tooltips aus ethlete/components statt nativer `title`-Tooltips (Befund 116).
- **A9** Merge-Ansicht mit dem einen Canvas (Zoom, Verschieben) und einem E2E-Test dafür (Befund 117; dl 02.11.).
- **A10** „Baubereit“ statt Go und Abnahme: ein Teil ist baubereit, wenn seine Prüfungen grün sind; direkte Änderung mit
  anderem Bild wird ein Sketch „alt/neu“ (Befund 109; dl 02.11.).
  Verschachtelte Parts sind eigenständig baubereit (eigene Zustände und Prüfungen); ein Host ist erst baubereit,
  wenn seine verschachtelten Parts es sind (Tom, 02.11.).
  Ein implementierter Part ist erst baubereit, wenn `design compare` App gegen Design grün ist (Befund 178).
  Ein Part ist erst baubereit, wenn er im Harness ohne SDK-Fehler rendert (update-dialog ET1205, 02.11.).
- **A13** Ein Knopf „Übernehmen“ statt „Wählen“: öffnet direkt die Merge-Ansicht, die ist die Bestätigung; Abbruch
  lässt nichts gewählt; kein Rückgängig nach dem Merge (Tom, 02.11.; „Pick and merge decisions“).
- **A14** Hinweis an Sketches, die sehr wahrscheinlich automatisch mergen.
- **A15** Kopf eines Sketches mit mehreren Teilen: Titel und „n Teile“ zum Aufklappen (Q244).
- **A16** Offene Punkte: veraltete Sketch-Basis, Sketch mit Namen, Entscheidung offen bis gebaut (Befunde 92, 93, 94).
- **A17** Teil-Baum behält die Scroll-Position beim Neuladen (Befund 99).
- **A18** Kommentar-Pins auch für gemergte Sketches und erledigte Kommentare in Sketches (Befund 122).
- **A19** Inbox: echte Benutzer statt „Du“, Zustand „unterbrochen“, echte Fehlermeldung (Q18, Q19, Q26).
- **A20** Eigener Baum für Flows; Abschnitte im Teil-Baum (Q22, Q60).
- **A21** Sketch-Ansicht: Variante ablehnen und wieder öffnen, Notizen, Diff-Listen – kommen sie zurück? (Q55; E7)
- **A22** Flows: Pins, Notizen (verschieben per Ziehen, Liste verwaister Notizen), Entwürfe, `jumpTo`; richtiges Seitenverhältnis je Preset; der eine Canvas (Q66, Q75, Q125).
- **A23** „Verwerfen“ mit Rückfrage (Q70).
- **A24** Merge-Seite zeigt alle unveränderten Teile, nicht nur das erste (Q72).
- **A25** Chat, Notizen und Knöpfe oben rechts kommen zurück, je mit Entwurf (Q81). Chat zeigt den Zustand des Agenten
  (arbeitet, wartet, unterbrochen, fehlgeschlagen) mit Stopp und Fortsetzen, Anmeldung in Studio, Verweis auf Teil,
  Sketch oder Kommentar (designer-workflow.md, Abschnitt 1).
- **A26** Studio-Menü: Einstellungen, Erscheinungsbild, Tastenkürzel, Hilfe, Über Studio (Q83).
- **A27** Server-Status: Neu laden, „veraltet“, Neustart, Stopp (Q88); „Scan“ für Checkouts (Q89).
- **A28** Popup „Ausnahmen N“ und alte Ansicht für Calls neu gestalten (Q91, Q92).
- **A29** Inventar überarbeiten: als Canvas, Assets, offene Overlays, Einstieg, Knopf „Alle Produkte“ (Q100, Q101, Q233,
  Q239).
- **A30** Zeilen im Popup „Offene Punkte“ anklickbar.
- **A31** Gleiche Darstellung aller Zellen im Raster mit Live-iframes; vorher Kosten messen.
- **A32** Sketch zeigt bei einer Änderung auch die Nachbarschaft (ganze Zeile, Zelle markiert).
- **A33** Zwei Designer in einem Projekt (E8).
- **A34** Übersetzung (i18n); die deutsche Label-Liste ist der Anfang (Q42).
- **A35** Motion-Editor.
- **A37** Design-Editor nach A35: der Designer passt im Sketch selbst an (echte Editor-Controls). Dazu Komfort wie in
  Figma: einzelne Komponenten anklicken und ihren Zustand sehen, in verschachtelte Komponenten hineinklicken. Großes
  Thema, eigene Grill-Runde vor dem Start (Tom, 29.10. und 02.11.; designer-workflow.md, Abschnitt 2: Herkunft eines
  Werts aus Token, geerbtem Teil oder eigenem Wert, Rückgängig, Zusammenspiel mit Agenten).
- **A36** Explorer: der Baum zeigt nur Teile, keine Zustände; Gruppen merken auf/zu; der Stift in der Leiste entfällt,
  „Sketches“ (nur offene) ganz oben, „Legacy“ zugeklappt ganz unten mit Projekten darunter. Zuerst Sketch (dl 02.11.).
  Verschachtelte Parts: ein Part, der zu einem Host gehört, liegt fest im Pfad darunter
  (`components/title-bar/title-search`) und im Explorer unter dem Host; der Check verweigert ihn außerhalb seines
  Hosts; allgemein genutzte Parts (Button, kbd) bleiben auf ihrer Ebene (Tom, 02.11.).
- **A38** Git in Studio: Repo holen, Branch anlegen und wechseln, Commit, Push, eingehende Änderungen und Konflikte, ohne
  eigenes Git-Setup; Chat, Editor und Git arbeiten auf demselben Stand (designer-workflow.md, Abschnitte 3 und 4).
- **A39** Bestehenden Frontend-Code importieren: eine Ansicht mit ihren Abhängigkeiten und Fixtures
  (existing-code-import.md; offene Entscheidungen dort).
- **A40** Neues Produkt in Studio anlegen: Formular mit Name und optionaler Basis (design-system/decisions-sketches.md).

## B. Design-CLI: neue Prüfungen

- **B1** Ein Teil wird eingebettet, nicht nachgezeichnet; ein App-Component je Teil; `--live` prüft ein Teil auf jeder
  Seite (Befunde 84, 85).
- **B2** `--live` meldet fertige Teile, die keine Seite zeigt (Befunde 89, 91).
- **B3** Prüfung bei breiterem Fenster: feste Breite in einem wachsenden Bereich (Befund 90).
- **B4** Hover-Zustand im Vergleich (Befund 96).
- **B5** Scroll-Position nach Neuladen prüfen (Befund 99).
- **B6** Größenänderung pro Canvas prüfen (Befund 100).
- **B7** SDK-Teile erben Schrift und Fläche richtig; Warnung bei veraltetem dist (Befund 101).
- **B8** Wiederholte Gruppen brauchen ein Control (Befund 102).
- **B9** Eine Token-Datei je SDK-Komponente; lokale Überschreibung wird gemeldet (Befund 103).
- **B10** Beispiel-Inhalt markieren (`data-et-demo`) und in App-Code finden (Befund 104).
- **B11** Lint-Regel `ethlete/no-native-title` und Design-Regel NATIVE-TITLE als Fehler einschalten, wenn A8 fertig ist (Befund 116).
- **B12** Asynchrone Aktionen: Zustand „pending“, zweiter Klick tut nichts (Befund 106).
- **B13** Radius eines Controls passt zum Kind, das es füllt (Befunde 107, 119).
- **B16** Eine getestete Offset-Hilfe für Fit und Kamera (Befund 129).
- **B17** Zustände auch mit echten, großen Daten prüfen (Befund 118).
- **B18** Jede Zeilen-Variante drücken, auch hinter einem Schalter (Befund 121).
- **B19** `emit:`-Aktion prüft auch, was der Host daraus macht (Befund 113).
- **B22** „Erreicht Zustand X“ auch bei Fehlschlägen, die nur aria-expanded prüft (Befund 131).
- **B23** Eine Vergleichsregel für die Ecken der SDK-Panels (Q51).
- **B24** Harness erzeugt die Tailwind-Klassen der Entwürfe selbst (Q50).
- **B25** `design dom --app` stellt Hover-, Active- und Klick-Zustände her, statt sie abzulehnen.
- **B27** Kanonische Tailwind-Klassen im App-Code prüfen.
- **B28** Ein Teil darf seine Größe nicht vom Inhalt eines Slots nehmen (Q47).
- **B31** Live-Aktionsprüfung: ein Navigations-Eintrag hat nach dem Klick `aria-current="page"` (Befund 84).
- **B32** Harness-Render mit leeren Inputs meldet Demo-Text, der trotzdem sichtbar bleibt (Befund 104).
- **B33** Prüfen, ob noch offen: `inventory.json` nicht Prettier-formatiert; erzwungenes Hover/Active auch auf
  disabled-Zuständen (dl, Systemlehren 01.11.).
- **B34** Studio zeigt einen Sketch, der nicht `ready` ist, als „in Arbeit“, je Variante „Agent baut gerade“
  (gebaut wird nach dem Design e: Kopf-Badge „In Arbeit“, je Variante „zeichnet“ und Platzhalter „<Modell> zeichnet diese
  Variante“)
  (neue sichtbare Oberfläche: erst Sketch pages/sketches, dann Bau; Befund 136, 143).
- **B35** `sketch check` und `sketch ready` scheitern an einer Variante, die noch das unveränderte Gerüst ist (Befund 136).
- **B36** Sketch-Ansicht: Rahmen in der gefitteten Größe des Teils, Spalten = Varianten + 1, Platz für den Kopf, „neu“
  statt leerem „Aktuell“; E2E mit kurzem und neuem Teil (Befund 136).
- **B37** `sketch check`/`sketch ready`: Notizen an Varianten und Teilen sind deutsch, kurz genug ohne Abschneiden und
  ohne technische Werte (dl 02.11.).
- **B38** Kopf einer Variante zeigt den kurzen Modellnamen statt „Claude“, Tooltip mit vollem Namen und Zeit
  (neue sichtbare Oberfläche: erst Sketch, dann Bau; dl 02.11., Befund 143).
- **B39** Wechselt eine Ansicht auf einen Design-Teil, muss jeder gelöschte Test entweder in der Liste „was das Design
  weglässt“ stehen oder im neuen Spec wieder auftauchen; die CLI prüft das (Befund 137).
- **B40** Jeder `partless`-Eintrag (bewusst ohne Teil) erscheint in Studio als offener Punkt, damit Tom ihn sieht; ein
  ungenutzter Eintrag ist ein Fehler (B30-Nachlauf).
- **B41** Studio zeigt `sketch hold` als Badge „Pausiert“, ein Klick zeigt den Grund (`--until`); ein Sketch in Arbeit
  ohne Bericht und ohne Dateiänderung seit N Minuten zeigt „keine Aktivität“ (Tom, 02.11.; Befund 138; Zustände
  gehören in den pages/sketches-Sketch).
- **B42** Pre-Push-Live-Prüfung liest offene Sketches aus dem Arbeitsbaum (`.ethlete/design`), nicht nur aus dem
  Klon; Test über den Klon-Pfad (Befund 139; blockiert den Push seit d8a90e8cb).
- **B43** Der ng()-Harness jedes Produkts registriert die Farb-Themes der App (Provider je Produkt in der Config)
  (Befund 140).
- **B44** `sketch check` und `design check` melden SDK-Warnungen aus der Konsole als Warnung, nicht nur ET-Fehler
  (Befund 140).
- **B45** Die Clipping-Prüfung überspringt bewusst unsichtbare sr-only-Elemente selbst, ohne `data-et-skip` (Befund
  141).
- **B46** Sketch im Kontext: Umschalter „Einzeln | Im Kontext“ in der Sketch-Ansicht, für jedes Produkt; bei
  mehreren Fundstellen die erste plus Auswahl; `sketch check` prüft die Passform im Kontext. Erst Sketch, dann Bau
  (Tom, 02.11.).
- **B47** Ansicht bleibt stabil: Spec prüft, dass eine wiederholte Größenmeldung keine neue iframe-Quelle und keine
  neue Größe setzt; E2E zählt iframe-Ladevorgänge 2 s nach dem Einschwingen, mehr als einer je Rahmen scheitert
  (Befund 142, Flackern).
- **B49** Rest: compare, Live-Vergleich, actions und dom scheitern auch laut an einer Fehlerseite im Rahmen; eine
  200-Seite mit Vites Fehler-Overlay zählt als Fehler (Befund 144).
- **B54** Design-Checks variieren die Eingaben: jeder Part wird mit abgeleiteten Fixture-Varianten gerendert (Anzahl
  0/1/N, Größen aus der Matrix, optionale Eingaben leer). Dazu die Sketch-Ansicht: Rahmen in echter Part-Größe, eine
  Zeile pro Variante, „Aktuell“ nur wenn der Part existiert, Refit bei Resize, Zustände der Varianten sichtbar,
  Notiz der Variante vollständig und lesbar groß; Check warnt bei Fließtext unter `text-ui-sm` oder auf eine Zeile
  gekürzt (Befund 148; sichtbar, also erst Sketch).
- **B55** `design check` lehnt einen Part ab, dessen Design-Prop variiert, aber keinen App-Input hat (ohne zu
  zeichnen); zoom-chip-Design korrigiert; ein Durchlauf von compare über alle Parts findet weitere, die nie
  vergleichbar waren; ein CI-Schritt vergleicht jeden fertigen Part erneut; die drei Abweichungen (shell-main,
  merge, system) sind Werkzeugfehler: compare wartet, bis Overlays stehen und alle Overlays des Zustands da sind,
  und friert laufende Animationen beim Bruchteil des Designs ein (Befund 149).
- **B57** Kompositions-Check: importiert ein Design einen umgesetzten Part, muss die Komponente dessen Komponente
  nutzen; der Task darf die Ordner komponierter Parts und `design-parts/shared/` ändern (Befund 151).
- **B58** Input-Check: Inputs, die keine App bindet (außer `designOnly`), `*_SAMPLE` als Input-Default und
  umgesetzte Parts ohne App-Importeur werden gemeldet; Seiten-Zustände tragen Daten statt Knöpfe (Befund 151).
- **B59** `implemented` wird streng: keine Einträge ohne `app`-Hashes, ein Spec mit Nicht-Fixture-Daten, Texte nur
  aus der Label-Map (Befund 151).
- **B60** Lint für App-Templates: kein Überschreiben von `et-button`-Innereien, keine handgemachten Fokusringe
  (stattdessen `etFocusRing`) (Befund 151).
- **B62** Merge-Ansicht: Ladezustand sofort, Liste füllt sich laufend, jede geänderte Zeile nennt den Grund (Pixel,
  fehlt, Fehler); E2E-Budget bis zur ersten Zeile und bis die gemergte Sketch aus dem Baum fällt; Render-Regel
  für Bezeichner, die mitten im Wort umbrechen, und für Fließtext in zu schmaler Spalte; Layout per Sketch, auch für die
  Befunde eines abgelehnten Merges, die heute in einer Zeile stehen (Befund 152, 150).
- **B63** Merge und `sketch ready` warnen bei einem Teil ohne `implements`-Link; der Go-Hash ignoriert den Link
  (Befund 153).
- **B64** Sketch-Brief und `sketch new`: ein Teil neben OS-Chrome zeigt diese als Demo-Inhalt in einem Slot, den
  compare leert (Befund 154).
- **B67** E2E „Hover allein zeichnet keinen Rahmen“ prüft jede Outline und jeden Schatten über dem Rahmen im ganzen
  Canvas; `studio:e2e` läuft in CI (Job nach dem cli-Build, `canvas.e2e.mjs --built`, nur bei Änderungen in
  apps/ethlete-studio/** oder libs/cli/src/lib/design/**); die echte Skizze pages/sketches r2 wird E2E-Ziel statt der
  synthetischen Ein-Varianten-Skizze (Befund 158).
- **B70** (geparkt bis zum Umbau des Go-Systems) Ein Go lässt sich zurücknehmen (Befund 162).
- **B71** Rest: erster Reload nach Kaltstart dauert 2,6 s statt ≤ 2 s; Ursache prüfen (volles Lesen blockiert den
  Node-Thread?), dann yield oder Cache in targetsOf/openSketchProblemsOf; sketches-tree.e2e.mjs in package.json und
  CI (mit B67) (Befund 161).
- **B74** `ng()`-Render registriert die Farb-Themes des Produkts; Render-Check meldet SDK-Konsolenwarnungen
  (Befund 164).
- **B76** Kompositions-Check: jeder Part, den die App rendert, steckt im Design-Part seines Hosts; Titelleiste
  gehört in die Shell (Befund 168).
- **B78** compare: einen DIFF vor dem Melden neu laufen lassen (FLAKY, wenn die Läufe abweichen); scheitern, wenn
  App und Design verschieden viele Overlay-Panes haben; Paritäts-Spec für die frozenAt-Mocks (Ursache der Flakes:
  Pane-Zählung ignorierte `<et-menu>`, caf6efa80).
  Dazu: die erzwungenen Interaktions-Zustände eines Parts ohne Go werden gegen sein letztes committetes Design
  verglichen (Befund 171).
- **B80** Render-Check CLIPPED: Ellipsis zählt nur auf Inline-Text (Flex/Grid mit Ellipsis bleibt CLIPPED, Hinweis
  „min-w-0 truncate am inneren Span“); beide Kanten messen (Kind-Rect gegen Clip-Box, fängt justify-center ohne
  -safe). Specs: Flex+Ellipsis CLIPPED, justify-center-safe sauber, Inline-truncate sauber (Befund 166).
- **B81** Render-Check Pan-Regionen: `data-et-pan="<Owner-Part>"` erklärt eine Pan-Region und nennt den Part, dem das
  Verhalten gehört (z. B. der Canvas); ein Schnitt dort ist ohne weiteren Hinweis ok, die Check-Ausgabe nennt den
  Owner (Befund 170); ein Skip deckt nur den eigenen Schnitt des Elements, nicht den seiner Kinder; neue
  Regel für Inhalt, der außerhalb einer Pan-Region mehr als eine Zeilenhöhe am Fenster- oder Frame-Rand abgeschnitten
  ist. Spec: overflow-hidden + Skip + hohes Kind meldet, mit data-et-pan sauber (Befund 167).
- **B83** Doc-Agent-Skill: vor jeder Grill-Frage den Part nennen, dem das Verhalten gehört; gehört es nicht dem Part
  im Design, keine Frage (höchstens ein Befund für den Owner); berührt die Frage ein System mit geplantem Umbau
  (z. B. Go -> A10), gehört sie in diesen Punkt statt in eine Einzelentscheidung. Durchsetzung: B81 macht den Owner im Markup sichtbar
  (Befund 170).
- **B82** `design compare` vergleicht bei jeder deklarierten Breite des Parts, nicht nur bei der ersten (Befund 156).
- **B84** Sketch-Ansicht markiert (Design e: nur markieren, nicht sortieren) und sortiert jede Variante nach ihrem ersten geänderten Zustand (dem, den der
  Identische-Varianten-Check vergleicht; folgt aus Entscheidung Variante e). system-tree.ts ordnet heute nach der
  Merge-Reihenfolge.
- **B85** Identische-Varianten-Check: eine Variante, die nicht lädt, meldet „nicht verglichen“ statt still zu
  bestehen.
- **B87** (hoch) Bash-PreToolUse-Hook Git: verweigert `git add -A`/`.`, `stash`, `--amend`, `git commit` ohne
  `--`-Pfade, Commits mit go.json, und Commits unter `.ethlete/design/` ohne Studio-Merge (Audit #23, #32, #33, #49).
- **B88** Hooks für Agentenrollen: Builder-Rolle verweigert `AskUserQuestion`; Schreiben in den Agent-Memory-Pfad
  wird verweigert; `subagent-model-policy` liest die Kontext-Stufe und verweigert neue Subagents ab 70 %
  (Audit #56, #54, #68).
- **B89** Design-Check für Implementierungen: Inputs müssen von einem Consumer gebunden sein (keine Sample-Defaults,
  keine Design-Knöpfe, Befund 151); Lint: Texte in Studio-Templates nur aus `STUDIO_LABELS`; `deniedClasses` um
  Fokusring- und et-button-Interna erweitern (Audit #6-#8, #10, #11, #13).
- **B90** CLI-Grenzen für Skizzen: `et design new` entfernen oder verweigern; discard/reject prüfen den Autor; Hook
  verweigert direkte Edits und `git rm` in gemergten Parts, solange keine Skizze offen ist (Audit #34, #36, #40, #41).
- **B91** `task --verify` und `ready` verweigern ohne Komponenten-Spec mit Nicht-Fixture-Daten (Audit #15).
- **B92** Plan-Lint beim Push: jeder Befund in design-to-code.md hat eine `Tool fix:`-Zeile (Audit #53).
- **B93** Skill-Aufräumen: Regeln aus builder-studio.md in den builder-agent-Skill; `sketch ready`-Text an B75
  anpassen; ein Ergebniskanal-Satz (SendMessage für Berichte an die Grill-Session, Datei für selbstberichtende
  Subagents); answered vs resolved bei Kommentaren; AGENTS.md: keine Trailer, schlägt die Harness-Attribution
  (Audit C1, C7-C10); B83 dazu.
- **B95** (hoch) Check eines geänderten Parts rendert auch jeden Part und jede offene Skizze, die ihn einbetten; das
  Commit-Gate genauso; eine Regel verweigert Zeichnen beim Modul-Laden; dazu `define-call.ts:47` (SDK-Render-Helfer
  liest `location` und lädt relativ, scheitert in Node für Seiten mit Titelleiste) (Befund 172).
- **B96** sdk components/stream: Consent- und Player-Error-Karte bei 320 px 3 px zu kurz (NESTED-SCROLL-Treffer);
  Fix im Stream-CSS in libs/components.
- **B97** Sketches-Ansicht ohne Auswahl: Klick und Pan wählen nichts aus, kein Rahmen; Shift+2 zoomt auf den Frame
  nächst der Ansichtsmitte (Befund 158, Entscheidung 02.11.).
- **B98** pages/inbox: die Seitenleisten-Liste scrollt erklärt (Design zeigt das Scrollen, z. B. Ausblenden unten),
  keine gekürzten Demo-Daten; danach Toms Go (NESTED-SCROLL-Treffer).
- **B99** Bash-Hook verweigert `pgrep -f`/`pkill -f`-Warteschleifen (matchen sich selbst) und verweist auf
  run_in_background oder Monitor; `restart` listet und beendet Hintergrund-Shells und Design-Prozesse der Session
  (Befund 173).
- **B100** Restliche prüfbare Regeln aus dem B79-Audit (Entscheidung 3, Liste der Ermessensregeln in
  design-to-code.md): `sketch` verweigert eine Skizze in einer Ebene, solange die Ebene darüber ungemergte Skizzen
  oder offene Punkte hat (#47); Stop-Hook prüft im Explorationsmodus eine offene Frage und höchstens 120 Wörter (#48)
  und bei aktivem Grilling das Rundenformat `❓ **Qn**` / `➡️` (#63); Plan-Lint beim Push verlangt pro Build-Slice
  eine „in progress“-Notiz und einen „as built“-Abschnitt (#58, mit B92); Lint-Regel oder Stop-Hook zählt neue
  Kommentare im Diff gegen die Allowlist (#93).
- **B101** Rest: ein echter `design shot --states` nach dem Rebuild eines veralteten dist (Befund 174).
- **B102** Rest: Builder mit `--role builder` starten; prüfen, dass `yarn agents:sync` den Stop-Hook-Eintrag in
  settings.json behält (Befund 175).
- **B105** Harness misst ohne eigene Größe: Host ohne Zeilenbox, App und Design an der Komponenten-Wurzel
  beschnitten; Spec, dass ein Element fester Größe im Harness seine Größe behält; danach alle vier Compares neu
  (Befund 178).
- **B106** „States by interaction“: Zustandszeile für ein markiertes Element nur, wenn der Part es selbst stylt;
  ein unveränderter eingebetteter Part behält seine Aktion ohne Zeile (Entscheidung 10, z. B. Buttons im
  update-dialog).
- **B107** CONTROL-STATE-Treffer: je eine Skizze für zoom-chip `reset`, shell-main `section` und shell-main
  `product` mit zwei Varianten (unveränderter SDK-Button, neuer eigener Control-Part); Tom wählt und mergt
  (Entscheidung 11).
- **B108** Regel UNUSED-PART-STYLES: eine Seite oder Skizze rendert einen Part und gibt nie seine `.styles` zurück;
  studio-mark.svg ohne sichtbaren Farb-Fallback; tote `studio-mark.component.ts` in der App löschen; `menu.styles` in pages/sketches d/e/f ergänzen (Befund 179).
- **B109** Der Sketch-Datensatz nennt je Variante den zeichnenden Agenten oder die Session; Studio und `et design
sketch` zeigen ihn (Befund 180).

## C. CLI: Tempo und Ablauf

- **C1** Trefferquote des Harness-Build-Cache messen; trifft er selten, ignoriert der Schlüssel Dateien, die der Build nicht liest (plans, sketch.json) (Q16).
- **C4** `design check` schneller machen, heute etwa 6:30 für Studio (Q23).
- **C5** Pre-push: Design-Dateien aus libs/components lösen die Design-Prüfung aus; tsc für berührte Produkte (Befund 105).

## D. SDK und Libs

- **D1** libs/components: 71 Import-Zyklen auflösen (Q116).
- **D2** Controls der fünf SDK-Teile carousel, scrollable, match, table, bracket.
- **D3** Fokus-Rahmen als API: `focusRingStyles`, öffentliche Tokens (E11).
- **D4** SDK-Teil `checkbox` (Studio nutzt noch die native Checkbox).
- **D5** Eigener Sketch für ein randloses, gedämpftes Select (Q231).
- **D6** Rahmen von `components/floating-action` (E10).
- **D7** Button-Farben gibt es zweimal (Design-Teil und libs/components); Checkbox und Radio-Group nachziehen.
- **D8** Aktive Farbe in icon-button und split-button (Q245), vielleicht schon erledigt.
- **D9** Studio: 8 Teile ohne App-Code; canvas-frames und studio-view sauber zuordnen (Q247, Q248).
- **D10** Die Matrix „Aktuell“ nur einmal, für App und CLI (Q124).
- **D11** 48 SDK-Teile haben noch offene Punkte.

## E. Fragen und Entwürfe für Tom

- **E3** Logo-Knopf: Radius bei Hover und Active (Befund 107).
- **E4** Schnellwahl: welche zwei Buchstaben, woher kommt das Logo?
- **E6** Entwürfe vor der Rückkehr: Chat, Notizen, Menü-Einträge, Server-Status, Scan, Update-Hinweis, „Ausnahmen N“,
  Inventar-Einstieg, „Alle Produkte“.
- **E7** Sketch-Ansicht: kommen Ablehnen, Notizen und Diff-Listen zurück, und wo?
- **E8** Zwei Designer: was muss ein Designer sehen? Tom denkt an Echtzeit wie in Figma.
- **E9** Live-iframes im Raster und Nachbarschaft im Sketch: erst messen, dann entscheiden.
- **E10** `floating-action`: Normalisierung erweitern oder `fa-page` behalten?
- **E11** Öffentliche Fokus-Rahmen-Tokens: SDK-API-Entscheidung.
- **E12** canvas-frames umbenennen und mit shell-main verknüpfen (Q248).
- **E13** Toms gesammelte Runde nach dem MVP (Q25, Q38): Status und Kommentar-Zahlen im Baum, Problemtext als Warnung,
  deutsche Tooltips am Zoom-Chip (Q41).
- **E14** Was zählt als „sehr wahrscheinlich automatisch gemergt“?
- **E15** Codex-Agenten: über die tmux-Mailbox oder über einen Wrapper? (backlog-parallel/decisions-studio-ui.md)
