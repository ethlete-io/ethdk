# Kunden-Vorlauf 2026-11-24 (B687, erster Lauf)

Lauf: `yarn client-run --sdk <gebaute SDK-Kopie>` (Kopie in `~/dev/client-runs/2026-11-24-0056`), ein Teil
(Titelkarte), Bildsatz mit 12 Titeln (11 mit Logo, 1 ohne). Der Agent meldete „Sketch fertig, drei Varianten,
alle richtig dargestellt“ und ließ keine Ablehnung offen; `sketch ready` lief durch.

## Befunde

- Einzelbild jedes Zustands der Varianten b und c ist ein schwarzes 48x48-Quadrat (`/__design/shot?...&sketch=&variant=b&priority=low`), der Bogen des Agenten zeigt b und c richtig. Verdacht: Einzel-Shot einer Sketch-Variante ungleich a findet den Teil nicht und zeichnet einen Platzhalter (Suspect, nicht bestätigt).
- Alle Karten stehen auf hellem Grund, obwohl Tomflix dunkel ist; der Agent schreibt selbst „Tomflix hat noch keine eigenen Farben“. Verdacht: das Start-Setup (`overlays/tomflix`) bringt nur `base` und keine Farb-Grundlage, das Werkzeug fordert keine an.
- Variante a: Dune-Logo blass und klein unter dem Plakat, der Titel steht doppelt (Plakat trägt ihn schon). Verdacht: der Auftrag nennt das Plakat-Motiv nicht, das Werkzeug meldet doppelte Titel nicht.
- Varianten b und c: orangefarbenes Logo auf weißem Verlauf kaum lesbar. Verdacht: kein Kontrast-Check für Bild-auf-Bild (Logo auf Hintergrund).
- Variante a: im Einzelbild sehen `logo` und `logo-focus-visible` (ebenso `fallback`) gleich aus, im Bogen trägt focus-visible einen Ring. Ursache (gemessen am Lauf 0130): der Shot enthält den Ring, er schneidet nichts ab. Der Ring ist deckend schwarz (`0,0,0,255`) auf durchsichtigem Grund (`0,0,0,0`), und `differenceOf` in `tools/client-run/png.mjs` verglich nur RGB, nicht Alpha: Unterschied 0. Fix: `differenceOf` vergleicht auch Alpha; Spec mit dem echten Dune-Paar aus Lauf 0130 (`png.spec.mjs`).
  Dasselbe Alpha-Loch hatte `inkOf` (Leer-Check): deckend schwarzer Inhalt auf Durchsichtigkeit zählte als leer. Gemessen: jede Karte aus Lauf 0130 hat auch helle Pixel (Ink 0,28 bis 0,64), kein echter Fehlalarm; der Spec beschneidet darum den reinen Ring-Streifen des Dune-Fokus-Shots. Fix: `inkOf` zählt auch Alpha; Prüfer auf Kopie des Laufs weiter 0 Befunde.
- Rückfall ohne Logo (John Williams) zeigt den Titel als Text: wie bestellt, kein Befund.

## Zweiter Prüflauf (Prüfer mit Bild-, Text-, Rahmen- und Baum-Check, SDK mit e9e2a06a4)

`yarn client-run --judge ~/dev/client-runs/2026-11-24-0056 --sdk <Scratch mit e9e2a06a4>`: 6 Befunde statt 21.

- Befund 1 (schwarze 48x48-Einzelbilder von b und c) ist weg: b und c zeichnen jetzt 200 bzw. 360 breit, kein leerer Zustand mehr.
- Varianten a, b und c: `logo` und `logo-focus-visible` (ebenso `fallback`) sehen im Einzelbild gleich aus, auch in b und c. Verdacht: der Einzel-Shot schneidet auf die Inhaltsbox und verliert den äußeren Fokus-Ring (Befund 5, jetzt in allen drei Varianten).
- Kein fehlendes Bild, kein abgeschnittener Text, kein Inhalt über den Rahmen, Baum zeigt den bestellten Sketch mit 3 Varianten: kein Befund.

## Offen (nächste Schritte)

- Zeitplan: Zeile für `crontab -e` in `tools/client-run/README.md`; der Mensch trägt sie ein.
- Prüfer: Scrollleiste in einem Element der Zelle (nur die Seiten-Scrollleiste wird erkannt; kein echter Fall als Vorlage).

## Lauf 2026-11-24-0130 (voller Lauf, SDK von HEAD fffdff6d5, 296 s, 9 Befunde)

- Alle drei Varianten, je Film, Serie und ohne Logo: der Prüfer meldet `*-focus-visible` als gleich wie der Ruhezustand, die Einzelbilder zeigen aber einen deutlichen weißen Ring um die Karte (Dune a, Knight c geprüft). Ursache: dieselbe wie Befund 5 (Alpha nicht verglichen, kein Schnitt). Nach dem Fix meldet der Prüfer auf einer Kopie des Laufs 0 statt 9 Befunde (36 Bilder, kein Fehler); andere echte Befunde hatte der Lauf nicht.
- Sonst nichts: kein fehlendes Bild, kein abgeschnittener Text, Baum zeigt die bestellten 3 Varianten; schwarze 48x48-Bilder sind weg.

## Lauf 2026-11-24-1029 (Brennpunkt-Auftrag, Start dunkel mit Akzent #e50914, 12 min, 14 Befunde)

- Farb-Grundlage dunkel kam an: „Kinosaal“ ist fast schwarz mit heller Schrift (B690 bewiesen).
- Suspect: der Agent ignoriert den Start-Akzent. Er nimmt Messing und schreibt „Rot habe ich bewusst nicht genommen“. Rot ist die gespielte Startantwort des Laufs (00f552e0f), nicht die Wahl des Menschen. Entscheidung Mensch 24.11.: der Start-Akzent ist bindend; eine andere Farbe darf der Agent nur als zusätzliche Variante neben dem gewählten Akzent zeigen. Nichts im Werkzeug sagt ihm das.
- Fehlalarm, behoben: 10 Befunde „Text abgeschnitten“ (Titelkarte b und c, ohne Logo, 2 px zu niedrig) und 1 „Text läuft aus dem Kasten“ (Farben, h1 3 px). Cause: der Prüfer maß die Glyphen-Box; die Tinte liegt 1 px (unten) und 4-9 px (oben) innen. Er misst jetzt die Tinte; Neuprüfung von 1029 meldet keinen der 11.
- Button a: hover gleich wie default (B697, schwacher Zustand; die Live-Prüfung meldete es dem Agenten nicht).
- Hero und App Shell blieben „in progress“: der Agent wartet auf den übernommenen Button und das Logo. Suspect: der Auftrag bestellt Teile, die von nicht gewählten Teilen abhängen.
- Keine eigene Schrift: der Agent konnte keine herunterladen.
- Stand Builder (Batch 53): Fehlalarme behoben a743686f3 (Prüfer misst Tinte, Biss, Neuprüfung 0 Textbefunde). Hero und Shell: Cause im Design-Skill (Agent wartete auf die Wahl anderer Teile), geändert ac7d61188, nicht verifiziert; der Lauf ab f688a59ee hat die Änderung noch nicht. Schrift: Cause Sandbox ohne Netz (gewollt); 46 B nutzt die Systemschrift, also bleibt es so.

## Lauf 2026-11-24-1109 (Start von 46 B, Fallen, Akzent-Regel; SDK f688a59ee; 27 Befunde)

- Alle sechs Teile fertig zur Wahl, je 3 Varianten. Akzent Rot hält überall (ACCENT-PRIMARY wirkt).
- Suspect: ACCENT-PRIMARY ist zu streng. Der Agent konnte das Türkis aus 46 B nicht als zusätzliche Variante zeigen; die Entscheidung 24.11. erlaubt eine andere Farbe als zusätzliche Variante.
- 13 Fallen ohne Zustand: Titelkarte ohne Plakat, 4K, 3D, Neue Folge, langer Titel, mobil; Hero Serie; Button gedrückt; App Shell gescrollt, versteckt, Tab-Leiste. Der Agent liest 46 B, zeichnet aber die Fallen nicht; nichts im Werkzeug fordert sie.
- Titelkarte a, b, c: focus-visible gleich wie rest (8 Befunde). Button a, b, c: default, hover und disabled gleich; der Agent sagt, das liegt an den vorläufigen Farben (B697).
- Hero a, b, c ohne Logo: Titel „John Williams: Live in Vienna“ läuft 20 px aus dem Kasten (Tinte gemessen). Suspect: echter Befund.
- Hero und Shell warten wieder auf die Wahl von Button und Logo (Lauf ohne ac7d61188).
- Feedback des Menschen 24.11. (Bild: foundations/logo Variante a, sieben Frames). Der Judge meldete nichts davon:
  - Bilder größer als ihr Frame: mark, colour-variants und minimum-size laufen unten aus dem Frame; anatomy, clear-space und motion füllen ihn nicht.
  - Viele Frames sind exakte Kopien: anatomy, clear-space, colour-variants, misuse und motion zeigen dasselbe T mit einem Titel. Kein Aufbau, kein Schutzraum, keine Farbvariante, keine falsche Verwendung. Ziel verfehlt.
  - motion bewegt sich nicht.
  - Der Agent schrieb selbst „Aufbau, Schutzraum und Mindestgröße sind vorerst nur Platzhalter“ (findings.md:53); das Werkzeug ließ die Variante trotzdem fertig zur Wahl werden.
- Feedback des Menschen 24.11. (Bild: elements/app-shell Variante a, desktop und phone):
  - Entscheidung Mensch 24.11.: die Shell ist nur Zusammensetzung. Suchkapsel, Reiter-Leiste und Avatar werden eigene Teile unter `components/`; der Agent legt sie an, wenn die Shell sie braucht (wie nötige Foundations). Die Shell zeigt nur Anordnung und Seiten-Zustände (gescrollt, Leiste versteckt, aktiver Reiter); Hover und Fokus zeigen die Teile. Der Auftrag bleibt bei sechs Teilen.
  - Befund: der Inhaltsbereich ist in beiden Breiten leer und schwarz; die Shell zeigt nicht, wie sie mit Inhalt wirkt.
  - Befund: die Chips „A–Z“ und „Filter“ sind dunkelrot auf Schwarz, kaum lesbar.
- Feedback des Menschen 24.11. (Bild: elements/title-card, Varianten a, b, c): die Varianten stehen untereinander, nicht nebeneinander; die Zellen einer Variante brechen nach drei Spalten um. Der Mensch will die Varianten nebeneinander vergleichen. Suspect: Layout der Sketch-Ansicht (B676). Weiter im Bild: hover sieht aus wie rest (B697); Variante a zeigt den Titel doppelt (Plakat-Schrift plus Logo, B705).
- Feedback des Menschen 24.11. (Bild: components/button, Block „Aktuell“): „dieses random initiale button design ist auch noch immer da“. Der Block zeigt den geerbten SDK-Button (tomflix erbt vom SDK, B700) mit Text „Save“ im Ersatz-Akzent; default und disabled sehen gleich aus; 10 von 12 Zuständen zeigen „neu in der Skizze“. Nichts sagt, dass das der SDK-Standard ist. Doc-Entscheidung (B700 angewandt): „Aktuell“ bleibt, trägt den Namen „SDK-Standard (geerbt)“ und zeichnet jeden Zustand, den der SDK-Button hat (disabled sichtbar anders). Zeile B719.
- Feedback des Menschen 24.11. (gleiches Bild: components/button): auch hier stehen die Varianten a, b, c untereinander; sie passen nebeneinander. Zweiter echter Fall zum Title-Card-Befund oben (B676).
