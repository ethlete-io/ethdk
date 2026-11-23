# Studio – Listen A-E

Zu [STATUS.md](STATUS.md).

## Maschinerie-Stapel

Steht in [machinery.md](machinery.md).

## A. Studio: was man sieht

- Suspect (23.11., Tomflix-Lauf): „Ordner nicht geöffnet – In diesem Ordner liegt keine Design-Arbeit.“ nennt weder den gewählten Ordner noch die fehlende `.ethlete/design/config.json`; unmöglich, wenn die Meldung beides nennt (B678 macht den Weg selten).
- **A25** Chat, Notizen und Knöpfe oben rechts kommen zurück, je mit Entwurf (Q81). Chat zeigt den Zustand des Agenten
  (arbeitet, wartet, unterbrochen, fehlgeschlagen) mit Stopp und Fortsetzen, Anmeldung in Studio, Verweis auf Teil,
  Sketch oder Kommentar (designer-workflow.md, Abschnitt 1).
  Notizen aus A22: Liste verwaister Notizen, Ziehen, `jumpTo`. Gebaut: verwaist = Notiz > 320 px von den Rahmen,
  Seitenpanel-Liste, Klick zentriert die Kamera (4f14cfb33, 5db381f84; Sprung im Browser ungeprüft); Start-Kamera (Cause gemessen: `offsetWithin`
  addierte den Seitenversatz, 4a564a541) und fokussierte neue Notiz (d4320a8bf, 8ef3a3470); `--verify` pages/flows grün.
  Suspect: veraltetes `KNOWN_ORPHAN_ENDPOINTS` (flow-note*); die Liste muss an einem Aufrufer scheitern.
  Kommentar-Pins: die App zeichnet sie schon im `[overlay]`-Slot der Zelle (Klick, Agent, Anzahl, erledigt); der
  Entwurf zeichnet sie ebenso über den Overlay-Slot (d55dc2b4f).
- **A29** Inventar als Canvas: ein Frame je Seite mit nummerierten Controls und Freigabe (ADR 0081, 0082, 0129),
  Assets- und Overlay-Listen in der App, Einstieg im Titelleisten-Menü (Q100, Q233, Q239). Canvas gebaut 5e9a7bcd2;
  Erfolgsfarbe gebaut 76f75766d (Limette Hue 130, SUCCESS_THEME Typ success, Inventar-Zeilen ok grün). Marker 4 px vom Frame-Rand 692d036db.
  Inventar-Panel gebaut (INVPANEL d385c7029..642313681): Kopf-Überlappung, Marker im nächsten freien Platz mit
  Mindestabstand und Theme-Text, deklarierte Controls deutsch beschriftet, Titelsuche-Komma an der Quelle behoben.
  Suspect: Marker-Berührungen an Rahmenunterkanten.
- **A34** Übersetzung (i18n); die deutsche Label-Liste ist der Anfang (Q42). Erster Schritt gebaut: „Panel ausblenden“ (642313681); alle festen Strings in Label-Dateien (f44a3ba90, 84c1233ec). Ruht bis ein englischsprachiger Nutzer Studio braucht (ADR 0406).
- **A35** Motion-Editor.
- **A37** Design-Editor nach A35: der Designer passt im Sketch selbst an (echte Editor-Controls). Dazu Komfort wie in
  Figma: einzelne Komponenten anklicken und ihren Zustand sehen, in verschachtelte Komponenten hineinklicken. Großes
  Thema, eigene Grill-Runde vor dem Start (der Mensch, 29.10. und 02.11.; designer-workflow.md, Abschnitt 2: Herkunft eines
  Werts aus Token, geerbtem Teil oder eigenem Wert, Rückgängig, Zusammenspiel mit Agenten).
- **A38** Git in Studio: Repo holen, Branch anlegen und wechseln, Commit, Push, eingehende Änderungen und Konflikte, ohne
  eigenes Git-Setup; Chat, Editor und Git arbeiten auf demselben Stand (designer-workflow.md, Abschnitte 3 und 4).
- **A39** Bestehenden Frontend-Code importieren: eine Ansicht mit ihren Abhängigkeiten und Fixtures
  (existing-code-import.md; offene Entscheidungen dort).

- Gruppe Design-Drift (gebaut bis b5e57ae51, Einzelheiten in git): Offen: Suspect: andere SDK-Designs mit text-shell-Feld; about-dialog Rest 15 px bleibt rot (nur eine Aufweitung der Antialias-Regel ADR 0341 bräuchte den Menschen).

- Befund (23.11., der Mensch, Tomflix-Lauf 2), alle gebaut (Einzelheiten in git): gleich hohe Varianten, Desktop neben Telefon, helle Zelle, „Neu starten“ (live ungeprüft), hängender Canvas, Variante in Arbeit bleibt live, Doppelklick live 2b051c38a, altes Repo mit Entwürfen öffnet als Produkt (B683, Cause: Studio nahm die alte CLI des Repos). Offen: bei 20 % Zoom bricht das Telefon-Label in vier Zeilen um; unmöglich, wenn ein Rahmen-Label nie umbricht. Suspect: Studio legte den Direkt-Sketch foundations-logo.edit ohne Bearbeitung an.
- Prüfer Lauf 2 (Batch 1-5): R2 Technik-Rede an den Kunden (Datenmodell, TMDB-Schlüssel, Rechte-Dialog, Pfade), Anleitung 4cec104cd; R3/R4 offen (kein Shell-Teil, keine Hover/Focus-Zustände). Bildsuche außerhalb der Kopie sah nur die Sandbox, kein Fehler. Suspect: ein Clean-Slate-Brief braucht einen Ablageort für Kunden-Bilder. Batch 6: +2 Aufteilung 46 B in richtiger Reihenfolge, +R3 elements/app-shell; R2 Technik-Rede („HTML-Datei“, „Quelltext“); Agent schrieb Ordner `extrahiert` in den Referenzordner des Menschen; `find /` nach dem Logo (obs 7); meldet „fehlerfrei“, Studio zeigt „noch nicht geprüft“.

## B. Design-CLI: neue Prüfungen

- **B1** Ein Teil wird eingebettet, nicht nachgezeichnet; ein App-Component je Teil; `--live` prüft ein Teil auf jeder
  Seite (Befunde 84, 85).
- **B2** `--live` meldet fertige Teile, die keine Seite zeigt (Befunde 89, 91).
- **B3** Prüfung bei breiterem Fenster: feste Breite in einem wachsenden Bereich (Befund 90).
- **B5** Scroll-Position nach Neuladen prüfen (Befund 99).
- **B6** Größenänderung pro Canvas prüfen (Befund 100).
- **B8** Wiederholte Gruppen brauchen ein Control (Befund 102).
- **B9** Eine Token-Datei je SDK-Komponente; lokale Überschreibung wird gemeldet (Befund 103).
- **B10** Beispiel-Inhalt markieren (`data-et-demo`) und in App-Code finden (Befund 104).
- **B11** Lint-Regel `ethlete/no-native-title` und Design-Regel NATIVE-TITLE als Fehler einschalten, wenn der zoom-chip/shell-collapse-Port aus B520 fertig ist (Befund 116).
- **B13** Radius eines Controls passt zum Kind, das es füllt (Befunde 107, 119).
- **B17** Zustände auch mit echten, großen Daten prüfen (Befund 118).
- **B18** Jede Zeilen-Variante drücken, auch hinter einem Schalter (Befund 121).
- **B19** `emit:`-Aktion prüft auch, was der Host daraus macht (Befund 113).
- **B22** „Erreicht Zustand X“ auch bei Fehlschlägen, die nur aria-expanded prüft (Befund 131).
- **B23** Eine Vergleichsregel für die Ecken der SDK-Panels (Q51).
- **B25** `design dom --app` stellt Hover-, Active- und Klick-Zustände her, statt sie abzulehnen.
- **B28** Ein Teil darf seine Größe nicht vom Inhalt eines Slots nehmen (Q47).
- **B32** Harness-Render mit leeren Inputs meldet Demo-Text, der trotzdem sichtbar bleibt (Befund 104).
- **B33** Prüfen, ob noch offen: `inventory.json` nicht Prettier-formatiert; erzwungenes Hover/Active auch auf
  disabled-Zuständen (dl, Systemlehren 01.11.).
- **B35** `sketch check` und `sketch ready` scheitern an einer Variante, die noch das unveränderte Gerüst ist (Befund 136).
- **B36** Sketch-Ansicht: Rahmen in der gefitteten Größe des Teils, Spalten = Varianten + 1, Platz für den Kopf, „neu“
  statt leerem „Aktuell“; E2E mit kurzem und neuem Teil (Befund 136).
- **B37** `sketch check`/`sketch ready`: Notizen an Varianten und Teilen sind deutsch, kurz genug ohne Abschneiden und
  ohne technische Werte (dl 02.11.).
  Suspect (21.11.): Sketch elements/studio-menu@edit lässt sich nach `pick new` + rebase nicht schließen: `sketch ready` verweigert „variants alike", `sketch discard` „pick contradicts HEAD" (ausgelöst durch `design check` auf dem Part-Edit eines Subagenten).
- **B38** Kopf einer Variante zeigt den kurzen Modellnamen statt „Claude“, Tooltip mit vollem Namen und Zeit
  (neue sichtbare Oberfläche: erst Sketch, dann Bau; dl 02.11., Befund 143).
- **B39** Wechselt eine Ansicht auf einen Design-Teil, muss jeder gelöschte Test entweder in der Liste „was das Design
  weglässt“ stehen oder im neuen Spec wieder auftauchen; die CLI prüft das (Befund 137).
- **B40** Jeder `partless`-Eintrag (bewusst ohne Teil) erscheint in Studio als offener Punkt, damit der Mensch ihn sieht; ein
  ungenutzter Eintrag ist ein Fehler (B30-Nachlauf).
- **B41** Studio zeigt `sketch hold` als Badge „Pausiert“, ein Klick zeigt den Grund (`--until`); ein Sketch in Arbeit
  ohne Bericht und ohne Dateiänderung seit N Minuten zeigt „keine Aktivität“ (der Mensch, 02.11.; Befund 138; Zustände
  gehören in den pages/sketches-Sketch).
- **B43** Der ng()-Harness jedes Produkts registriert die Farb-Themes der App (Provider je Produkt in der Config)
  (Befund 140).
- **B44** `sketch check` und `design check` melden SDK-Warnungen aus der Konsole als Warnung, nicht nur ET-Fehler
  (Befund 140).
- **B46** Sketch im Kontext: Umschalter „Einzeln | Im Kontext“ in der Sketch-Ansicht, für jedes Produkt; bei
  mehreren Fundstellen die erste plus Auswahl; `sketch check` prüft die Passform im Kontext. Erst Sketch, dann Bau
  (der Mensch, 02.11.).
- **B47** Ansicht bleibt stabil: Spec prüft, dass eine wiederholte Größenmeldung keine neue iframe-Quelle und keine
  neue Größe setzt; E2E zählt iframe-Ladevorgänge 2 s nach dem Einschwingen, mehr als einer je Rahmen scheitert
  (Befund 142, Flackern).
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
- **B60** Lint für App-Templates: kein Überschreiben von `et-button`-Innereien, keine handgemachten Fokusringe
  (stattdessen `etFocusRing`) (Befund 151).
- **B62** Merge-Ansicht: Ladezustand sofort, Liste füllt sich laufend, jede geänderte Zeile nennt den Grund (Pixel,
  fehlt, Fehler); E2E-Budget bis zur ersten Zeile und bis die gemergte Sketch aus dem Baum fällt; Render-Regel
  für Bezeichner, die mitten im Wort umbrechen, und für Fließtext in zu schmaler Spalte; Layout per Sketch, auch für die
  Befunde eines abgelehnten Merges, die heute in einer Zeile stehen (Befund 152, 150).
- **B64** Sketch-Brief und `sketch new`: ein Teil neben OS-Chrome zeigt diese als Demo-Inhalt in einem Slot, den
  compare leert (Befund 154).
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
- **B84** Sketch-Ansicht markiert (Design e: nur markieren, nicht sortieren) und sortiert jede Variante nach ihrem ersten geänderten Zustand (dem, den der
  Identische-Varianten-Check vergleicht; folgt aus Entscheidung Variante e). system-tree.ts ordnet heute nach der
  Merge-Reihenfolge.
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
  `product` mit zwei Varianten (unveränderter SDK-Button, neuer eigener Control-Part); der Mensch wählt und mergt
  (Entscheidung 11).
  sketch` zeigen ihn (Befund 180).
- Suspect (19.11.): `spec:stress` meldet Playwright-Specs nach 1 s mit 0/4 (nur für vitest gebaut).
- Suspect (19.11.): der Mac-post-merge-Hook findet `node` nicht über nicht-Login-SSH; Mac-Vergleich braucht `zsh -lc`.
- Lücke (19.11.): kein Weg, die Tauri-Dev-Webview zu fotografieren; kein Szenario-Ordner in `libs/timetrack`.
- Cause (19.11., gebaut 4c1c3fae5): im Weg-Modus erreichte die Rechtefrage eines fable-Cross-Checks den Menschen und schaltete den Weg-Modus aus.
- Suspect (20.11.): der Design-Harness kann Inhalt (Pins) nicht in einen Part projizieren, daher weicht `compare` bei `pinned` ab (D9d).

## C. CLI: Tempo und Ablauf

- Cause (20.11., gemessen, zu 40bf18228 + 396f40278): Mac-Maintenance-Sleep suspendiert den Design-Server, kein Fetch-Hänger (pmset-Log, 164 s = Sleep 04:05:28); fetch-watch benennt einen suspendierten Server, canvas.e2e startet auf macOS caffeinate; `/__design/sketches` 227,6 -> 53,3 s. Suspect: `--cpu-prof` über Sleep verklemmt den builtin-loader-rwlock.
- Cause (22.11., gemessen, nichts gebaut): merge-commit.ts l.210 hält den Produkt-Lock 2,9 s, fast ganz in den git-Hooks (staged-data-specs.mjs 1,85 s); Limit 10 s; merge.ts l.569/645 88/7 ms (Suspect widerlegt).
- Cause (21.11., gemessen, nichts gebaut): `design check --part elements/variant-cell` kalt 81 s, `--slow` 28 s, APP-SPEC <= 13 s; das 1200-s-Limit waren 53 verwandte Specs, 562c389c7 schnitt sie auf 7.
- Gruppe design server / c0: tsconfig-Umschreiben zweier Design-Server zu 47637234d (Cause gemessen: Pfad in den Server-Snapshot mit pid; 0 statt 2 volle Reloads/min). Machinery: pre-push fing Goldens/Klassenliste/e2e geänderten Verhaltens nicht (S30); Studio-e2e "open points row that names a part opens that part" CI b1b26d7f9 Click-Timeout, lokal grün, Suspect Last.
- Gruppe c0/B403 (SLOWFAIL 4a3dc7efa, lokal): slow-checks.json cachte einen fehlgeschlagenen Slow-Check bis zur Eingabeänderung; der Cache speichert nur noch Treffer (Bite 5 Specs rot -> grün); ein alter Fehlschlag steht als „pending“, bis der nächste Check ihn neu fährt. Regression fd6b2a513 (Cause gemessen): 4a3dc7efa verwarf Cache-Einträge mit baselined nicht blockierenden Treffern (shell-main CONTROL-STATE, ADR 0201), sie blieben ewig „pending“; Schreiben/Lesen urteilt nun nach `slowProblemsOf`-Blockern, Spec beißt den alten Code, live bestätigt (shell-main build-ready). Zweites Mal (22.11., Cause gezeigt): der Aktions-Cache compare-actions-* spielte einen Probe-Timeout als Fehler 3x wieder ab; unmöglich, wenn kein Design-Cache Fehlschläge speichert. Offen (Suspect): `check --slow --part elements/shell-main` besteht, `ready` meldet danach noch „slow checks have not run on the current inputs“. Befund (21.11., TTROWS): ein Rot als WT-env geparkt ohne Bite (die 8 Studio-e2e-Shards auf 8523b8aa7 scheitern im Sketch-Fixture-Setup: zoom-chip, shell-main, title-bar-Hinweis ändern mehr als einen Zustand; Suspect: STUDIO_LABELS-Sweep a16779bf8/4b5d03e05, durch CIFIX 9aaadf9d2 als Fixture-Import-Cause bewiesen). Suspect (23.11.): `ready pages/sketches` fällt mit 68 Aktions-Prüfungen der Titelleisten-Knöpfe in drawing/auto-merge (Click-Timeout, „design draws no such element“), älter als B680. Suspect (23.11.): die alte Seite eines Direkt-Sketches löst Imports gegen den aktuellen Stand auf (pages/sketches@edit, sketch-question). Werkzeug-Lücke (22.11.) zu 3f2894b16: `sketch rebase` lässt einen gepickten Sketch mit unveränderter Variante gepickt (Bite-Spec); ein Agent-Pick ohne Merge-Commit fällt weiter (by design 2b4a85177).
- CHECKPERF (22.11., Cause gemessen): das „zweite render-inspect“ im Skizzen-Check = checkEmbedders prüft die 5 Einbetter von comment-row voll. Einbetter-Kürzungen in git. Serve-Queue-Suspect widerlegt (gemessen): mit serve open-points 1-2 s statt 1,1 s, kein Lock, keine Queue; Quelle der 141 s offen. Unterphasen gemessen 8dc6f0f31: variant-cell open-points kalt 19,95 s, davon 17,13 s Harness-Start in settle-slow (Cause gemessen), warm 1,05 s; die 199-481 s nicht reproduziert. CI-Budget der Studio-e2e wieder grün (2-4,3 min). 23.11.: voller Studio-Check 40 Teile 136 s (Ziel 60 s) nach define-part-Änderung.

## D. SDK und Libs

## E. Fragen und Entwürfe für den Menschen

- **E3** Logo-Knopf: Radius bei Hover und Active (Befund 107).
- **E4** Schnellwahl: welche zwei Buchstaben, woher kommt das Logo?
- **E6** Entwürfe vor der Rückkehr: Chat, Notizen, Menü-Einträge, Server-Status, Scan, Update-Hinweis, „Ausnahmen N“,
  Inventar-Einstieg, „Alle Produkte“.
- **E10** `floating-action`: Normalisierung erweitern oder `fa-page` behalten?
- **E12** canvas-frames umbenennen und mit shell-main verknüpfen (Q248).
- **E13** Die gesammelte Runde des Menschen nach dem MVP (Q25, Q38): Status und Kommentar-Zahlen im Baum, Problemtext als Warnung,
  deutsche Tooltips am Zoom-Chip (Q41).
- **E15** Codex-Agenten: über die tmux-Mailbox oder über einen Wrapper? (ADR 0369)
