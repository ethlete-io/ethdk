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
- Suspect Fehlalarm: 10 Befunde „Text abgeschnitten“ (Titelkarte b und c, ohne Logo, 2 px zu niedrig) und 1 „Text läuft aus dem Kasten“ (Farben, h1 3 px). Die Bilder zeigen keinen sichtbaren Schnitt. Der Prüfer misst die Glyphen-Box, nicht die Tinte.
- Button a: hover gleich wie default (B697, schwacher Zustand; die Live-Prüfung meldete es dem Agenten nicht).
- Hero und App Shell blieben „in progress“: der Agent wartet auf den übernommenen Button und das Logo. Suspect: der Auftrag bestellt Teile, die von nicht gewählten Teilen abhängen.
- Keine eigene Schrift: der Agent konnte keine herunterladen.
