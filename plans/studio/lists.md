# Studio – Listen A-E

Zu [STATUS.md](STATUS.md).

## Maschinerie-Stapel

**Maschinerie-Stapel** (nur bei rotem CI bauen; steuert den Builder nicht): Cause (gemessen: rot mit `node_modules/.vitest-cache`, 7/7 mit `--no-fsModuleCache`): der vitest-fs-Modul-Cache liefert für bearbeitete Dateien veralteten kompilierten Code; Specs nur mit `--no-fsModuleCache` grün, `spec:stress` falsch 0/4 (bb18b9f26-Slice), und das „lastempfindliche“ progress-steps-Szenario (3 rot in großem `vitest related`-Lauf, 7/7 allein, 1053ab687, f9940515d) ist dieselbe Ursache. Nur bei rotem CI bauen. Suspect: `lint:no-verify-briefs` scannt die ignorierten `.claude/handoffs/*.md` und blockierte einen Push wegen eines zitierten Flags in einem Handoff. Agenten können CI-Job-Logs nicht lesen (403, Admin nötig; keine Test-Artefakte), ein roter Unit-Test-Job ist nur lokal nachzustellen (15.11.). Suspect: agent-rules output-style.spec „falls back to the home directory“ liest die Umgebung und fällt lokal rot, sobald `CLAUDE_CONFIG_DIR` gesetzt ist (CI setzt es nicht). Suspect (16.11.): `restart --process claude2` beendete die tmux-Session des Builders statt sie neu zu starten (der Prozess-Exit schließt die Session vor dem Neustart); von Hand mit `run claude2 claude ... --role builder` neu gestartet. Suspect (16.11., fifa): `restart` tippt einen zweiten Resume-Prompt in eine belegte Session, wenn eine Hintergrundaufgabe ihren Turn offen hält (fifa bekam zwei Handoffs); gebaut e8dccb2e3. Suspect (16.11.): `slice-paths` ist eine Datei pro Checkout, parallele Agents überschreiben sich (nur Warnung). Suspect (16.11.): nach einem Rebase verweigert `sketch ready` eine vom Builder gewählte Edit-Skizze, nur `--reopen` hilft und behauptet eine Nutzerbitte. Cause (16.11., gebaut ee74c30a1, d03478c4d, 8b24d45e0): der Dispatcher tippte fremde Mailbox-Nachrichten in die fifa-Session eines anderen Repos. Cause (17.11.): ein veralteter vite/vitest-Transform-Cache (`node_modules/.vite/libs/components`) gibt lokal falsche Rote mit falschen Source-Maps (WHOLE_PIXEL_HEIGHT, rte-tools-Szenario); kein Import-Zyklus. Suspect (17.11.): eine Edit-Skizze, die nur eine von einem ADR verlangte Entfernung zeichnet, braucht trotzdem eine Merge-Wahl; der Agent-Merge wird vom Rechte-Klassifizierer abgelehnt (zweimal, pages/inbox@edit; nur der Mensch kann ihn ausführen). Suspect (17.11.): der Builder vergab schon geschlossene Zeilen-IDs neu (B540/B541); die nächste ID nimmt das Maximum über STATUS und git log. Befund (17.11., zweites Mal, CI auf 4365c1e71): Studio-e2e „[Discard] a sketch discarded while its view is open“ läuft unter Last in den Timeout von `locator.click`; vorher geparkt (babbe94e0). Rot in 4 Läufen (f0b523141..79e7fe93b), lokal nie rot (auch `--load 8`); grün auf bbd783ed6, der Fall druckt beim nächsten Rot, was er sah. Suspect: langsames Mounten auf dem belasteten 4-Kern-Runner (1 statt 7 Baumzeilen-Rahmen). Suspect (17.11.): jeder Push bricht den laufenden vollen Behavior-Lauf ab (cancel-in-progress), so bekommt der Selektor keine grüne Basis; der Builder hält Pushes, bis die Shards fertig sind. Suspect: die cdk-Klassenlisten-Spec fehlt im pre-push (export-coverage dort seit 8a2d87f02). Cause (19.11., CI rot 44467937172 auf B304): Rust-Clippy (`-D warnings`) läuft nicht im Builder-Check, nur `cargo test`; Fix 272a9aa94. Erstes Mal. Suspect (19.11.): ein Subagent meldete Typecheck grün für eine Story mit nicht existierendem Input (`renderButtons`), erst der Push-Typecheck fing es (6c28cd15b). Cause (19.11.): `lint:changesets` verlangt eine `none`-Changeset auch für ein ADR unter `libs/<pkg>/` (Doc-Agent-Commit 50ae5d053 ohne, Builder-Push abgelehnt, nachgereicht a6a119a5d). Cause (19.11.): Playwright `connectOverCDP` setzt beim Verbinden `colorScheme: 'light'` und hebt es beim Trennen auf; Timetrack wechselte dadurch hell/dunkel (B602). Suspect (20.11.): `yarn adr:governs` löst in Kommentaren zitierte Timetrack-ADR-Nummern als Studio-ADRs auf (0006/0015/0018/0040). Suspect (20.11.): `e2e-map.mjs` ordnet Sketch-Änderungen `sketches-tree` mit Standard-Produkt studio zu, das keine Skizze hat (scheitert an der Vorbedingung); canvas-e2e `--hold-listings` ignoriert `--case`. Cause (20.11., restart.log): `restart --process` speicherte `run` selbst als Befehl, der Neustart wurde verweigert und die Builder-Session verschwand; gebaut d1d1ba612, 5303dc32d (B658). Cause (20.11., Log): der Perf-Job lief in den 20-min-Timeout, CI wurde abgebrochen und Publish übersprungen; Perf aus dem Publish-Pfad (e506e76ba). Befund (20.11., zweimal, der Mensch sah es): der Builder füllt die vier Slots nicht (einmal solo im Vordergrund nach Neustart, einmal 2/4 bei freier Warteschlange); Skill-Zeile „nach jedem Subagent-Ergebnis erst auf vier auffüllen“ wartet auf gleich viele gestrichene Wörter. Suspect (20.11.): voller Design-Check lief 122,8 s statt 60 s wegen Cache-Fehlschlägen durch parallele Agent-Edits (warm 12 s); Exit 1 war ein nicht abgewartetes Promise in thumb.ts (4a69fff3b). Info: Mailbox an fifa nur aus dem fifagg-Checkout (AGENT_MAILBOX allein wird abgelehnt). Cause (20.11., CI rot 785209bbe/21fdf094f, `agents:check`): 53fd28446 bearbeitete die erzeugte `.agents/skills/ethlete-domain-modeling/ADR-FORMAT.md` statt der Quelle in `libs/agent-rules/content`; Fix 2849771fe. Unmöglich, wenn pre-commit eine gestagte erzeugte Skill-Datei ablehnt. Cause (21.11., Journal): systemd-oomd beendete um 00:15 die ganze Builder-tmux-Session (356 Prozesse, 44,9 GB), weil e2e- und Design-Server der Worker in ihrem Scope liefen; gebaut feeca7dea (schwere Jobs in eigenem Scope mit MemoryMax, Agenten mit ManagedOOMPreference=avoid), offen: nx/vitest ebenso. Suspect (21.11.): `sketch ready` überspringt die Regionsprüfung still, wenn ein Edge-Frame unter dem Seitenpanel liegt (beide A28-Varianten). Zweites Mal (21.11.): Worker überschrieben gegenseitig ihre Scratchpad-Nachrichtendatei (A29-Commit bekam die OOM-Nachricht); Briefs nennen nun eigene Dateien. Suspect (21.11.): `restart --process` baute einen verstümmelten `zsh -lic`-Befehl, die Builder-Session verschwand, und derselbe Neustart setzte `ETHLETE_AGENT_ROLE=builder` auf der Grill-Session (Quoting und Rollenvererbung); Builder von Hand neu gestartet, Fix beim Builder (RESTARTFIX). Suspect (21.11.): agent-sessions.spec rot aus einer Agent-Shell und in CI (Runner ohne systemd-User-Session, RESTARTFIX 2). Suspect (21.11., CIMJ a7e58df01): ein losgelöstes `git maintenance` berührt `.git` während `cpSync` im merge-journal-Spec; kehrt es wieder, tar-Snapshot. Defekt (21.11., A29): `sketch merge` von foundations/colors rollt zurück, wenn `generate-studio-themes` nicht vorher lief; der Merge muss die Themes selbst erzeugen; gebaut (INVPANEL). Cause (bite, 21.11., READYFIX d0d16b34c): ein run-many-Build leert `dist` ~8 s und `isBuildRunning` erkannte nur `nx build <lib>`, daher verweigerte `design ready` (comment-pin, 2x) mit „dist/libs/components missing“; wartet nun; 2b171e9a0: eine verweigerte Freigabe committet nie ein Drop. Cause (21.11., bite, CPUSPIN): libcef MessagePumpGlib mit 0 ms Timeout unter externer Pumpe, Leerlauf 99,5 % -> 0,8 % CPU. RESTARTFIX 5efbc1827 gebaut (Login-Shell-Quoting, Peer-Rolle bleibt, own-scope-Spec ohne User-Bus übersprungen). Cause (21.11., CIFIX): own-scope-Spec ohne systemd in CI rot (b60970c63 fälscht busctl/systemd-run), `COMPONENTS_CLASSES` ohne `et-scrollable-buttons--inside` (d1152d2fd); Suspect: Rust-Host-SIGTERM 5000 ms nur ein Runner-Flake (40/40 lokal); lokal auf Basis rot: „fails run loudly when the started program ends at once“. Cause (21.11., gesehen): `sketch withdraw` verweigert Nicht-Duplikat-Varianten (withdraw soll jede ungewählte nehmen). Suspect (21.11.): `sketch round` auf unveränderter Beschriftung ändert keinen Pixel (zwei Skizzen).

- Suspect (19.11.): commitlint lehnt den Scope `timetrack` ab, der Builder nimmt `repo`.
- Suspect (19.11.): der slice-paths-Hook warnt über `apps/timetrack/src/**`, obwohl genau dieses Glob gesetzt war.
- Suspect (19.11.): die Timetrack-Dev-App starb 01:25 (SIGBUS), als ein Subagent mit `cargo test`/`clippy` das laufende
  `target/debug/timetrack` neu linkte. Unmöglich, wenn `nx serve timetrack-app` in ein eigenes Target-Verzeichnis baut.
- Cause (19.11., dreimal): WIP eines Subagenten (Debug-Code, Band-Versuch 2) kam per Hot-Reload in Toms laufende
  Timetrack-Dev-App und verfälschte seinen Tag. Unmöglich, wenn Subagenten in einem eigenen Scratch-Checkout arbeiten.
- Befund (19.11., Doc-Agent, viermal): Grill-Frage oder Befund auf ungeprüfter Annahme, obwohl die Antwort dastand
  (tank headless; schon in der Roadmap; Mac->tank über WireGuard steht in B616; parallele Blöcke = Timetrack ADR 0043).
  Vor jeder Frage und jedem Befund Rechnerfakten, `libs/timetrack/docs/adr`, `plans/timetrack/roadmap.md` und `rows.md` prüfen.
- Suspect (19.11.): Plan-Commits laufen ohne `lint:plans`; eine Faltung verlor Befund-Verweise (11, 28, 29), erst der
  Pre-Push des Builders fing es (fecfbc1bb).
- Suspect: `yarn adr:governs` ordnet Timetrack-ADR-Nummern (`libs/timetrack/docs/adr`) den Studio-ADRs mit derselben Nummer zu (zitierte 0039-0041 in `frozen-rows.ts` listeten Studio 0039-0041).
- Cause (20.11., Code): `yarn commit` ohne `-- <paths>` staged jede ungetrackte Datei (commit-wait.mjs addUntracked, leere
  Pfadangabe) und nahm fast Dateien anderer Agents mit. Unmöglich, wenn ohne Pfade nichts dazukommt.
- Cause (20.11., git): ein Subagent committete a155bf140 per commit-tree an den Hooks vorbei (commitlint rot); einmalig
  umformuliert (ADR 0391). Unmöglich, wenn Subagenten nur über `yarn commit` committen.
- Cause (20.11., Code): pre-push läuft weder `studio:classes:check` (eigener CI-Schritt, kein eslint) noch die Unit-Specs der Libs; die cdk-Spec components-classes liest das CSS von der Platte, daher findet `vitest related` sie nicht (rotes CI 44806835681). Unmöglich, wenn die Regel `canonical-class` ein eslint-Lauf ist und die Spec das CSS importiert, das sie liest.
- Cause (20.11.): Agent-Isolation `worktree` schneidet von main und löscht sich selbst; bei zwei Subagenten fiel ein fehlgeschlagenes `cd` auf den Haupt-Checkout zurück und `git checkout -B` lief dort (kurz verschoben, wiederhergestellt). Unmöglich, wenn Builder-Slices `git worktree add` auf origin/next nutzen und jeder Aufruf mit `cd <wt>` beginnt.

## A. Studio: was man sieht

elements/shell-main` zeigt schon vorher 2 CONTROL-STATE und „changed outside a sketch“ (vermutlich d961cb00d).

- **A22** Flows: Pins, Entwürfe; der eine Canvas (Q66, Q125). Notizen (Liste verwaister Notizen, Ziehen, `jumpTo`)
  gehören zu A25 (ADR 0120). Rest geteilt (ADR 0367, Impl Q125): A22a Flows-Seite auf ethlete-design-canvas (0 px),
  A22b Pin und Entwurfszustände in pages/flows mit Kommentar-Store nach ADR 0367, A22c Sprung aus der Seitenleiste
  zu einem Flow-Kommentar öffnet den Teil (NOTESFIX läuft).
- **A25** Chat, Notizen und Knöpfe oben rechts kommen zurück, je mit Entwurf (Q81). Chat zeigt den Zustand des Agenten
  (arbeitet, wartet, unterbrochen, fehlgeschlagen) mit Stopp und Fortsetzen, Anmeldung in Studio, Verweis auf Teil,
  Sketch oder Kommentar (designer-workflow.md, Abschnitt 1).
  Notizen aus A22: Liste verwaister Notizen, Ziehen, `jumpTo`. Gebaut: verwaist = Notiz > 320 px von den Rahmen,
  Seitenpanel-Liste, Klick zentriert die Kamera (4f14cfb33, 5db381f84; Sprung im Browser ungeprüft); Start-Kamera (Cause gemessen: `offsetWithin`
  addierte den Seitenversatz, 4a564a541) und fokussierte neue Notiz (d4320a8bf, 8ef3a3470); `--verify` pages/flows grün.
  Suspect: veraltetes `KNOWN_ORPHAN_ENDPOINTS` (flow-note*); die Liste muss an einem Aufrufer scheitern.
  Kommentar-Pins: der Zustand `pinned` von elements/variant-cell ist gezeichnet, die App zeichnet keine Pins (Cause
  gemessen, DIFF 1255 px, vor A32).
- **A29** Inventar als Canvas: ein Frame je Seite mit nummerierten Controls und Freigabe (ADR 0081, 0082, 0129),
  Assets- und Overlay-Listen in der App, Einstieg im Titelleisten-Menü (Q100, Q233, Q239). Canvas gebaut 5e9a7bcd2;
  Erfolgsfarbe gebaut 76f75766d (Limette Hue 130, SUCCESS_THEME Typ success, Inventar-Zeilen ok grün).
  Inventar-Panel gebaut (INVPANEL d385c7029..642313681): Kopf-Überlappung, Marker im nächsten freien Platz mit
  Mindestabstand und Theme-Text, deklarierte Controls deutsch beschriftet, Titelsuche-Komma an der Quelle behoben.
  Suspect: Marker-Berührungen an Rahmenunterkanten.
- **A34** Übersetzung (i18n); die deutsche Label-Liste ist der Anfang (Q42). Erster Schritt gebaut: „Panel ausblenden“ (642313681).
- **A35** Motion-Editor.
- **A37** Design-Editor nach A35: der Designer passt im Sketch selbst an (echte Editor-Controls). Dazu Komfort wie in
  Figma: einzelne Komponenten anklicken und ihren Zustand sehen, in verschachtelte Komponenten hineinklicken. Großes
  Thema, eigene Grill-Runde vor dem Start (Tom, 29.10. und 02.11.; designer-workflow.md, Abschnitt 2: Herkunft eines
  Werts aus Token, geerbtem Teil oder eigenem Wert, Rückgängig, Zusammenspiel mit Agenten).
- **A38** Git in Studio: Repo holen, Branch anlegen und wechseln, Commit, Push, eingehende Änderungen und Konflikte, ohne
  eigenes Git-Setup; Chat, Editor und Git arbeiten auf demselben Stand (designer-workflow.md, Abschnitte 3 und 4).
- **A39** Bestehenden Frontend-Code importieren: eine Ansicht mit ihren Abhängigkeiten und Fixtures
  (existing-code-import.md; offene Entscheidungen dort).

- Suspect (21.11., SHELLCOL): shell-collapse `--verify` rot (focus-visible 114x88 Design gegen 130x88 App; vermutlich längerer deutscher Tooltip, Design auf altes Label bemessen).

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
- **B46** Sketch im Kontext: Umschalter „Einzeln | Im Kontext“ in der Sketch-Ansicht, für jedes Produkt; bei
  mehreren Fundstellen die erste plus Auswahl; `sketch check` prüft die Passform im Kontext. Erst Sketch, dann Bau
  (Tom, 02.11.).
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
  `product` mit zwei Varianten (unveränderter SDK-Button, neuer eigener Control-Part); Tom wählt und mergt
  (Entscheidung 11).
  sketch` zeigen ihn (Befund 180).
- Suspect (19.11.): `spec:stress` meldet Playwright-Specs nach 1 s mit 0/4 (nur für vitest gebaut).
- Suspect (19.11.): der Mac-post-merge-Hook findet `node` nicht über nicht-Login-SSH; Mac-Vergleich braucht `zsh -lc`.
- Lücke (19.11.): kein Weg, die Tauri-Dev-Webview zu fotografieren; kein Szenario-Ordner in `libs/timetrack`.
- Cause (19.11., gebaut 4c1c3fae5): im Weg-Modus erreichte die Rechtefrage eines fable-Cross-Checks Tom und schaltete den Weg-Modus aus.
- Suspect (20.11.): `capability-place.spec` „confirmed studio list ... warnings“ scheitert lokal (zweites Mal gesehen: D10, C4d/D9c); Ursache unbekannt.
- Suspect (20.11.): der Design-Harness kann Inhalt (Pins) nicht in einen Part projizieren, daher weicht `compare` bei `pinned` ab (D9d).

## C. CLI: Tempo und Ablauf

- Suspect (20.11.): vite fetchModule (dist/libs/components) hängt auf dem Mac unabhängig von der Last, Render läuft nach 60 s in den Timeout. Unmöglich, wenn: eine Render-Anfrage scheitert schnell und nennt das hängende Modul, statt still nach 60 s. Nächster Mac-Versuch: Design-Log behalten, Render-Endpunkt direkt mit curl.
- Suspect (20.11.): `sleepSync` im Produkt-Lock (2,9 s) steht bei parallelen Sessions im Wettstreit.
- Suspect (21.11.): voller `design check --part elements/variant-cell` lief in der App-Spec-Phase in das 1200-s-Limit (Ursache offen, nicht reproduziert; 562c389c7 senkte die verwandten App-Specs 53 -> 7, Slice DCHECK).
- Suspect (21.11.): ein veralteter residenter Design-Prozess meldet bei `sketch check` „did not draw its embedded frames“ bis `et:design stop`.

## D. SDK und Libs

- **D2** Controls der fünf SDK-Teile carousel, scrollable, match, table, bracket. Design-Arbeit, keine Prio (Tom, 04.11.): jedes Control braucht gezeichnete Interaktionszustände, das Budget sinkt im selben Commit; match evtl. nur `controls: {}`. Alle fünf deklariert und gezeichnet, Lib-Zustände d7bd937e5; Ready-Marken carousel 2b18a4fef, table a26a86f32, comment-pin b4a671179, variant-cell und title-search build-ready (variant-cell fertig); offen: `design ready pages/flows` verweigert, 12 eingebettete Parts nicht build-ready (vorher schon).

## E. Fragen und Entwürfe für Tom

- **E3** Logo-Knopf: Radius bei Hover und Active (Befund 107).
- **E4** Schnellwahl: welche zwei Buchstaben, woher kommt das Logo?
- **E6** Entwürfe vor der Rückkehr: Chat, Notizen, Menü-Einträge, Server-Status, Scan, Update-Hinweis, „Ausnahmen N“,
  Inventar-Einstieg, „Alle Produkte“.
- **E10** `floating-action`: Normalisierung erweitern oder `fa-page` behalten?
- **E12** canvas-frames umbenennen und mit shell-main verknüpfen (Q248).
- **E13** Toms gesammelte Runde nach dem MVP (Q25, Q38): Status und Kommentar-Zahlen im Baum, Problemtext als Warnung,
  deutsche Tooltips am Zoom-Chip (Q41).
- **E15** Codex-Agenten: über die tmux-Mailbox oder über einen Wrapper? (ADR 0369)
- **E16** Morgenrunde 15.11.: beantwortet (ADR 0300 B501, 0301 B502 `opens:`, 0302 B514 + 986 geparkt; fifa-Session
  neu gestartet). Studio-Wahlen title-bar@uncommitted (B501 P4), pages/system@canvas-note, shell-main@crashed,
  title-bar@notice-arrow, empty-state@row-layout, action-sheet@look (B508): Builder baut seine Empfehlung (Tom stellt
  keine Design-Wahlen, 07.11.), Zeile "Empfehlung gebaut". Erledigt vom Doc-Agent 15.11. (Tom erlaubt): `gh` angemeldet, B505-main gepusht, zshrc `claude2()`, Mac auf `next` mit
  ssh-Schlüssel ohne Passphrase (`~/.ssh/id_ed25519_agent`).
