# Studio – Status

Stand: 02.11.2026, nachts

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

Builder: A1-Fensterknöpfe gebaut und gepusht (fe4c9899b, a1698f47a); jetzt parallel B22, B30 und C1. Reihenfolge von Liste A (Tom, 02.11.): A1, A36, A8, dann A9 und A10, dann A5 bis A7, danach der Rest der Reihe nach. Was man sieht, startet immer mit einem Sketch.

## Erledigt

MVP fertig (02.11.). Erledigte Einträge fliegen aus den Listen; die Historie steht in `git log -- plans/ethlete-studio/STATUS.md`.

## A. Studio: was man sieht

- **A1** Titelleiste als Teil: zuerst Sketch `components/title-bar` mit Fensterknöpfen, Suche und Update-Knopf; Tom wählt,
  dann Code angleichen (die Fensterknöpfe sind gebaut, aber ohne Entwurf; Befund 133; dl 02.11.).
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
- **A13** Sketch „gewählt, aber nicht gemergt“ sichtbar machen oder beides in einem Schritt.
- **A14** Hinweis an Sketches, die sehr wahrscheinlich automatisch mergen.
- **A15** Kopf eines Sketches mit mehreren Teilen: Titel und „n Teile“ zum Aufklappen (Q244).
- **A16** Offene Punkte: veraltete Sketch-Basis, Sketch mit Namen, Entscheidung offen bis gebaut (Befunde 92, 93, 94).
- **A17** Teil-Baum behält die Scroll-Position beim Neuladen (Befund 99).
- **A18** Kommentar-Pins auch für gemergte Sketches und erledigte Kommentare in Sketches (Befund 122).
- **A19** Inbox: echte Benutzer statt „Du“, Zustand „unterbrochen“, echte Fehlermeldung (Q18, Q19, Q26).
- **A20** Eigener Baum für Flows; Abschnitte im Teil-Baum (Q22, Q60).
- **A21** Sketch-Ansicht: Variante ablehnen und wieder öffnen, Notizen, Diff-Listen – kommen sie zurück? (Q55; E7)
- **A22** Flows: Pins, Notizen, Entwürfe, `jumpTo`; richtiges Seitenverhältnis je Preset; der eine Canvas (Q66, Q75, Q125).
- **A23** „Verwerfen“ mit Rückfrage (Q70).
- **A24** Merge-Seite zeigt alle unveränderten Teile, nicht nur das erste (Q72).
- **A25** Chat, Notizen und Knöpfe oben rechts kommen zurück, je mit Entwurf (Q81).
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
  Thema, eigene Grill-Runde vor dem Start (Tom, 02.11.).
- **A36** Explorer: der Baum zeigt nur Teile, keine Zustände; Gruppen merken auf/zu; der Stift in der Leiste entfällt,
  „Sketches“ (nur offene) ganz oben, „Legacy“ zugeklappt ganz unten mit Projekten darunter. Zuerst Sketch (dl 02.11.).

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
- **B30** `design check --live` meldet sichtbare App-Bereiche, die kein Teil abdeckt; für Studio im Pre-Push als Fehler
  (Befund 133).

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
