# Studio – Listen A-E

Zu [STATUS.md](STATUS.md).

## Maschinerie-Stapel

**Maschinerie-Stapel** (nur bei rotem CI bauen; steuert den Builder nicht): Cause (gemessen: rot mit `node_modules/.vitest-cache`, 7/7 mit `--no-fsModuleCache`): der vitest-fs-Modul-Cache liefert für bearbeitete Dateien veralteten kompilierten Code; Specs nur mit `--no-fsModuleCache` grün, `spec:stress` falsch 0/4 (bb18b9f26-Slice), und das „lastempfindliche“ progress-steps-Szenario (3 rot in großem `vitest related`-Lauf, 7/7 allein, 1053ab687, f9940515d) ist dieselbe Ursache. Nur bei rotem CI bauen. Suspect: `lint:no-verify-briefs` scannt die ignorierten `.claude/handoffs/*.md` und blockierte einen Push wegen eines zitierten Flags in einem Handoff. Agenten können CI-Job-Logs nicht lesen (403, Admin nötig; keine Test-Artefakte), ein roter Unit-Test-Job ist nur lokal nachzustellen (15.11.). Suspect: agent-rules output-style.spec „falls back to the home directory“ liest die Umgebung und fällt lokal rot, sobald `CLAUDE_CONFIG_DIR` gesetzt ist (CI setzt es nicht). Suspect (16.11.): `restart --process claude2` beendete die tmux-Session des Builders statt sie neu zu starten (der Prozess-Exit schließt die Session vor dem Neustart); von Hand mit `run claude2 claude ... --role builder` neu gestartet. Suspect (16.11., fifa): `restart` tippt einen zweiten Resume-Prompt in eine belegte Session, wenn eine Hintergrundaufgabe ihren Turn offen hält (fifa bekam zwei Handoffs); gebaut e8dccb2e3. Suspect (16.11.): `slice-paths` ist eine Datei pro Checkout, parallele Agents überschreiben sich (nur Warnung). Suspect (16.11.): nach einem Rebase verweigert `sketch ready` eine vom Builder gewählte Edit-Skizze, nur `--reopen` hilft und behauptet eine Nutzerbitte. Cause (16.11., gebaut ee74c30a1, d03478c4d, 8b24d45e0): der Dispatcher tippte fremde Mailbox-Nachrichten in die fifa-Session eines anderen Repos. Cause (17.11.): ein veralteter vite/vitest-Transform-Cache (`node_modules/.vite/libs/components`) gibt lokal falsche Rote mit falschen Source-Maps (WHOLE_PIXEL_HEIGHT, rte-tools-Szenario); kein Import-Zyklus. Suspect (17.11.): eine Edit-Skizze, die nur eine von einem ADR verlangte Entfernung zeichnet, braucht trotzdem eine Merge-Wahl; der Agent-Merge wird vom Rechte-Klassifizierer abgelehnt (zweimal, pages/inbox@edit; nur der Mensch kann ihn ausführen). Suspect (17.11.): der Builder vergab schon geschlossene Zeilen-IDs neu (B540/B541); die nächste ID nimmt das Maximum über STATUS und git log. Befund (17.11., zweites Mal, CI auf 4365c1e71): Studio-e2e „[Discard] a sketch discarded while its view is open“ läuft unter Last in den Timeout von `locator.click`; vorher geparkt (babbe94e0). Rot in 4 Läufen (f0b523141..79e7fe93b), lokal nie rot (auch `--load 8`); grün auf bbd783ed6, der Fall druckt beim nächsten Rot, was er sah. Suspect: langsames Mounten auf dem belasteten 4-Kern-Runner (1 statt 7 Baumzeilen-Rahmen). Suspect (17.11.): jeder Push bricht den laufenden vollen Behavior-Lauf ab (cancel-in-progress), so bekommt der Selektor keine grüne Basis; der Builder hält Pushes, bis die Shards fertig sind. Cause (17.11., gefixt 1d3b11fd3): neue Bracket-Exports ohne Szenario-Nutzung und neue et-Klassen ohne cdk-Klassenliste wurden erst in CI rot (9f270e41c, 44f193a00). Suspect: components:export-coverage und die cdk-Klassenlisten-Spec fehlen im pre-push. Befund (19.11., zweites Mal, CI rot 44451905556 auf b23a3ab16): core:export-coverage rot, weil neue SEO-Szenariofälle fünf noch erlaubte Stores abdeckten (c4cb8d354); export-coverage ist weiter nicht im pre-push, jetzt bauen (rotes CI). Suspect (19.11.): ein Subagent meldete Typecheck grün für eine Story mit nicht existierendem Input (`renderButtons`), erst der Push-Typecheck fing es (6c28cd15b).

- Suspect (19.11.): commitlint lehnt den Scope `timetrack` ab, der Builder nimmt `repo`.
- Suspect (19.11.): der slice-paths-Hook warnt über `apps/timetrack/src/**`, obwohl genau dieses Glob gesetzt war.
- Suspect (19.11.): die Timetrack-Dev-App starb 01:25 (SIGBUS), als ein Subagent mit `cargo test`/`clippy` das laufende
  `target/debug/timetrack` neu linkte. Unmöglich, wenn `nx serve timetrack-app` in ein eigenes Target-Verzeichnis baut.
- Suspect: `yarn adr:governs` ordnet Timetrack-ADR-Nummern (`libs/timetrack/docs/adr`) den Studio-ADRs mit derselben Nummer zu (zitierte 0039-0041 in `frozen-rows.ts` listeten Studio 0039-0041).

## A. Studio: was man sieht

- **A1** Titelleiste: Sketch `components/title-bar` Variante C ist gemergt (02.11.); jetzt den Code angleichen
  (Fensterknöpfe, Suchfeld „studio / Part“, Update-Knopf nur bei bereitem Update; Befund 133).
  Gebaut ff698951f (c8, ungepusht; SDK-Fensterknopf `shape: 'caption'`). Offen: die 12 übersprungenen Hover-Zustände
  (Befund 483), ein echtes Windows-Fenster, Sketch `components/title-bar@notice-hint` (Befund 484). `check --part
elements/shell-main` zeigt schon vorher 2 CONTROL-STATE und „changed outside a sketch“ (vermutlich d961cb00d).
- **A6** Schnellwahl in der Leiste zeigt Logo oder zwei eindeutige Buchstaben, mit Tooltip (Q21).
- **A9** Merge-Ansicht mit dem einen Canvas (Zoom, Verschieben) und einem E2E-Test dafür (Befund 117; dl 02.11.).
- **A10** Baubereit (ADR 0048): der Kern, B250 und B251 sind gebaut; offen ist nur der Live-Nachweis der B251b-Skizze (Bild der App in `design serve`); die Wahl von `built` merget als Platzhalter mit offenem Punkt `redraw` (Commit "Keep a merged built pick as a placeholder with a redraw open point").
- **A14** Hinweis an Sketches, die sehr wahrscheinlich automatisch mergen.
- **A16** Offene Punkte: veraltete Sketch-Basis, Sketch mit Namen, Entscheidung offen bis gebaut (Befunde 92, 93, 94).
- **A18** Kommentar-Pins auch für gemergte Sketches und erledigte Kommentare in Sketches (Befund 122).
- **A19** Inbox: echte Benutzer statt „Du“, Zustand „unterbrochen“, echte Fehlermeldung (Q18, Q19, Q26).
- **A20** Eigener Baum für Flows; Abschnitte im Teil-Baum (Q22, Q60).
- **A22** Flows: Pins, Notizen (verschieben per Ziehen, Liste verwaister Notizen), Entwürfe, `jumpTo`; richtiges Seitenverhältnis je Preset; der eine Canvas (Q66, Q75, Q125).
- **A25** Chat, Notizen und Knöpfe oben rechts kommen zurück, je mit Entwurf (Q81). Chat zeigt den Zustand des Agenten
  (arbeitet, wartet, unterbrochen, fehlgeschlagen) mit Stopp und Fortsetzen, Anmeldung in Studio, Verweis auf Teil,
  Sketch oder Kommentar (designer-workflow.md, Abschnitt 1).
- **A26** Studio-Menü, Rest (Q83): Menü und System-Picker gebaut (as built in archive/findings-2026-11.md). Offen, je eine
  Skizze (ADR 0121): Dialog Einstellungen (Ctrl ,), Dialog Tastenkürzel (Ctrl /), Ziel von Hilfe (Doku-URL, Opener im
  Host), Dialog Über Studio (Version, Lizenz); Hell und Wie System brauchen ein helles Oberflächen-Theme. Bis dahin
  stehen die Einträge deaktiviert im Menü.
- **A27** Server-Status: Neu laden, „veraltet“, Neustart, Stopp (Q88); „Scan“ für Checkouts (Q89).
- **A28** Popup „Ausnahmen N“ und alte Ansicht für Calls neu gestalten (Q91, Q92).
- **A29** Inventar überarbeiten: als Canvas, Assets, offene Overlays, Einstieg, Knopf „Alle Produkte“ (Q100, Q101, Q233,
  Q239).
- **A31** Gleiche Darstellung aller Zellen im Raster mit Live-iframes; vorher Kosten messen.
- **A32** Sketch zeigt bei einer Änderung auch die Nachbarschaft (ganze Zeile, Zelle markiert).
- **A34** Übersetzung (i18n); die deutsche Label-Liste ist der Anfang (Q42).
- **A35** Motion-Editor.
- **A37** Design-Editor nach A35: der Designer passt im Sketch selbst an (echte Editor-Controls). Dazu Komfort wie in
  Figma: einzelne Komponenten anklicken und ihren Zustand sehen, in verschachtelte Komponenten hineinklicken. Großes
  Thema, eigene Grill-Runde vor dem Start (Tom, 29.10. und 02.11.; designer-workflow.md, Abschnitt 2: Herkunft eines
  Werts aus Token, geerbtem Teil oder eigenem Wert, Rückgängig, Zusammenspiel mit Agenten).
- **A36** Explorer, Rest (Stift weg 3a89a94d5, Beispiel-Ebenen in App-Reihenfolge): verschachtelte Parts
  (`components/title-bar/title-search`): die CLI findet keinen Part unter einem Host-Ordner, Schlüssel sind
  `<layer>/<name>`; der Check verweigert einen Part außerhalb seines Hosts nicht. Gebaut: aus der Nutzung (ADR 0294).
- **A38** Git in Studio: Repo holen, Branch anlegen und wechseln, Commit, Push, eingehende Änderungen und Konflikte, ohne
  eigenes Git-Setup; Chat, Editor und Git arbeiten auf demselben Stand (designer-workflow.md, Abschnitte 3 und 4).
- **A39** Bestehenden Frontend-Code importieren: eine Ansicht mit ihren Abhängigkeiten und Fixtures
  (existing-code-import.md; offene Entscheidungen dort).
- **A40** Neues Produkt in Studio anlegen: Formular mit Name und optionaler Basis (ADR 0366).

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
- **B11** Lint-Regel `ethlete/no-native-title` und Design-Regel NATIVE-TITLE als Fehler einschalten, wenn der zoom-chip/shell-collapse-Port aus B520 fertig ist (Befund 116).
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
- **B60** Lint für App-Templates: kein Überschreiben von `et-button`-Innereien, keine handgemachten Fokusringe
  (stattdessen `etFocusRing`) (Befund 151).
- **B62** Merge-Ansicht: Ladezustand sofort, Liste füllt sich laufend, jede geänderte Zeile nennt den Grund (Pixel,
  fehlt, Fehler); E2E-Budget bis zur ersten Zeile und bis die gemergte Sketch aus dem Baum fällt; Render-Regel
  für Bezeichner, die mitten im Wort umbrechen, und für Fließtext in zu schmaler Spalte; Layout per Sketch, auch für die
  Befunde eines abgelehnten Merges, die heute in einer Zeile stehen (Befund 152, 150).
- **B63** Merge und `sketch ready` warnen bei einem Teil ohne `implements`-Link (Befund 153).
- **B64** Sketch-Brief und `sketch new`: ein Teil neben OS-Chrome zeigt diese als Demo-Inhalt in einem Slot, den
  compare leert (Befund 154).
- **B67** E2E „Hover allein zeichnet keinen Rahmen“ prüft jede Outline und jeden Schatten über dem Rahmen im ganzen
  Canvas; `studio:e2e` läuft in CI (Job nach dem cli-Build, `canvas.e2e.mjs --built`, nur bei Änderungen in
  apps/ethlete-studio/** oder libs/cli/src/lib/design/**); die echte Skizze pages/sketches r2 wird E2E-Ziel statt der
  synthetischen Ein-Varianten-Skizze (Befund 158).
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
  Dazu: die erzwungenen Interaktions-Zustände eines nicht baubereiten Parts werden gegen sein letztes committetes Design
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
  im Design, keine Frage (höchstens ein Befund für den Owner); berührt die Frage ein System mit geplantem Umbau,
  gehört sie in diesen Punkt statt in eine Einzelentscheidung. Durchsetzung: B81 macht den Owner im Markup sichtbar
  (Befund 170).
- **B82** `design compare` vergleicht bei jeder deklarierten Breite des Parts, nicht nur bei der ersten (Befund 156).
- **B84** Sketch-Ansicht markiert (Design e: nur markieren, nicht sortieren) und sortiert jede Variante nach ihrem ersten geänderten Zustand (dem, den der
  Identische-Varianten-Check vergleicht; folgt aus Entscheidung Variante e). system-tree.ts ordnet heute nach der
  Merge-Reihenfolge.
- **B85** Identische-Varianten-Check: eine Variante, die nicht lädt, meldet „nicht verglichen“ statt still zu
  bestehen.
- **B87** (hoch) Bash-PreToolUse-Hook Git: verweigert `git add -A`/`.`, `stash`, `--amend`, `git commit` ohne
  `--`-Pfade und Commits unter `.ethlete/design/` ohne Studio-Merge (Audit #23, #32, #33, #49).
- **B88** Hooks für Agentenrollen: Builder-Rolle verweigert `AskUserQuestion`; Schreiben in den Agent-Memory-Pfad
  wird verweigert; `subagent-model-policy` liest die Kontext-Stufe und verweigert neue Subagents ab 70 %
  (Audit #56, #54, #68).
- **B89** Design-Check für Implementierungen: Inputs müssen von einem Consumer gebunden sein (keine Sample-Defaults,
  keine Design-Knöpfe, Befund 151); Lint: Texte in Studio-Templates nur aus `STUDIO_LABELS`; `deniedClasses` um
  Fokusring- und et-button-Interna erweitern (Audit #6-#8, #10, #11, #13).
- **B90** CLI-Grenzen für Skizzen: `et design new` entfernen oder verweigern; discard/reject prüfen den Autor; Hook
  verweigert direkte Edits und `git rm` in gemergten Parts, solange keine Skizze offen ist (Audit #34, #36, #40, #41).
- **B91** `task --verify` und `ready` verweigern ohne Komponenten-Spec mit Nicht-Fixture-Daten (Audit #15).
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
  keine gekürzten Demo-Daten; danach baubereit (NESTED-SCROLL-Treffer).
- **B99** Bash-Hook verweigert `pgrep -f`/`pkill -f`-Warteschleifen (matchen sich selbst) und verweist auf
  run_in_background oder Monitor; `restart` listet und beendet Hintergrund-Shells und Design-Prozesse der Session
  (Befund 173).
- **B102** Rest: Builder mit `--role builder` starten; prüfen, dass `yarn agents:sync` den Stop-Hook-Eintrag in
  settings.json behält (Befund 175).
- **B106** „States by interaction“: Zustandszeile für ein markiertes Element nur, wenn der Part es selbst stylt;
  ein unveränderter eingebetteter Part behält seine Aktion ohne Zeile (Entscheidung 10, z. B. Buttons im
  update-dialog).
- **B107** CONTROL-STATE-Treffer: je eine Skizze für zoom-chip `reset`, shell-main `section` und shell-main
  `product` mit zwei Varianten (unveränderter SDK-Button, neuer eigener Control-Part); Tom wählt und mergt
  (Entscheidung 11).
  sketch` zeigen ihn (Befund 180).

## C. CLI: Tempo und Ablauf

- **C1** Trefferquote des Harness-Build-Cache messen; trifft er selten, ignoriert der Schlüssel Dateien, die der Build nicht liest (plans, sketch.json) (Q16).
- **C4** `design check` schneller machen, heute etwa 6:30 für Studio (Q23).

## D. SDK und Libs

- **D2** Controls der fünf SDK-Teile carousel, scrollable, match, table, bracket.
- **D3** Fokus-Rahmen als API: `focusRingStyles`, öffentliche Tokens (E11).
- **D4** SDK-Teil `checkbox` (Studio nutzt noch die native Checkbox).
- **D5** Eigener Sketch für ein randloses, gedämpftes Select (Q231).
- **D6** Rahmen von `components/floating-action` (E10).
- **D7** Button-Farben gibt es zweimal (Design-Teil und libs/components); Checkbox und Radio-Group nachziehen.
- **D9** Studio: 8 Teile ohne App-Code; canvas-frames und studio-view sauber zuordnen (Q247, Q248).
- **D10** Die Matrix „Aktuell“ nur einmal, für App und CLI (Q124).
- **D11** SDK-Teile: 5239 offene Punkte in 50 von 57 Teilen; 5104 davon fehlende Motions (B297). Rest: 85 fehlende Zustände, 29 ohne Controls, 20 Kontraste, 6 Kommentare; Design-Arbeit, keine Prio (Tom, 04.11.). Builder baut Empfehlung: menu item-active Kurzbefehl 4.10:1 (volle Textfarbe), chart bar-/pie-empty Umriss (contrast.exceptions). Empfehlung gebaut: menu built bdb5acaf6; chart dropped, check shows CONTRAST-PAIR 0.
  16.11.: pages/inbox und pages/sketches bekommen ihre ready-Marke erst, wenn die offenen Punkte der eingebetteten Teile zu sind (button, select, hold-trigger, comment-draft, comment-row, anchored-dialog; textarea/badge/tooltip nur Motions, B297); damit auch sketch-status-badge, canvas-frames, studio-menu. B520 schließt ohne sie.
- **D19** Ein JSON-Writer für beide Libs statt zwei Kopien (`libs/agent-rules/src/lib/prettier.ts`, `libs/cli/src/lib/json-file.ts`). Subpath-Exports von agent-rules müssen im Workspace auf gebautes JS auflösen (`@ethlete/agent-rules/prettier` auf TS-Quelle ließ die gebaute CLI abstürzen, zurückgenommen). Danach `part-ready.ts` auf den Writer umstellen (nach A10).
- **D20** core Head-Store (fifa 7.26, 15.11.): Titel-Teil ohne öffentliche Priorität; Schreiben aus einem Effect, der den Store liest, läuft endlos. [fifagg-sdk-findings-2026-11-15-seo.md](../sdk/fifagg-sdk-findings-2026-11-15-seo.md)

## E. Fragen und Entwürfe für Tom

- **E3** Logo-Knopf: Radius bei Hover und Active (Befund 107).
- **E4** Schnellwahl: welche zwei Buchstaben, woher kommt das Logo?
- **E6** Entwürfe vor der Rückkehr: Chat, Notizen, Menü-Einträge, Server-Status, Scan, Update-Hinweis, „Ausnahmen N“,
  Inventar-Einstieg, „Alle Produkte“.
- **E9** Live-iframes im Raster und Nachbarschaft im Sketch: erst messen, dann entscheiden.
- **E10** `floating-action`: Normalisierung erweitern oder `fa-page` behalten?
- **E11** Öffentliche Fokus-Rahmen-Tokens: SDK-API-Entscheidung.
- **E12** canvas-frames umbenennen und mit shell-main verknüpfen (Q248).
- **E13** Toms gesammelte Runde nach dem MVP (Q25, Q38): Status und Kommentar-Zahlen im Baum, Problemtext als Warnung,
  deutsche Tooltips am Zoom-Chip (Q41).
- **E15** Codex-Agenten: über die tmux-Mailbox oder über einen Wrapper? (ADR 0369)
- **E16** Morgenrunde 15.11.: beantwortet (ADR 0300 B501, 0301 B502 `opens:`, 0302 B514 + 986 geparkt; fifa-Session
  neu gestartet). Studio-Wahlen title-bar@uncommitted (B501 P4), pages/system@canvas-note, shell-main@crashed,
  title-bar@notice-arrow, empty-state@row-layout, action-sheet@look (B508): Builder baut seine Empfehlung (Tom stellt
  keine Design-Wahlen, 07.11.), Zeile "Empfehlung gebaut". Erledigt vom Doc-Agent 15.11. (Tom erlaubt): `gh` angemeldet, B505-main gepusht, zshrc `claude2()`, Mac auf `next` mit
  ssh-Schlüssel ohne Passphrase (`~/.ssh/id_ed25519_agent`).
