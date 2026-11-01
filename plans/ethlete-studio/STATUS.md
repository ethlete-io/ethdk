# Studio – Status

Stand: 02.11.2026, nachts

## Ziel

Das MVP ist erreicht (02.11.): alle 17 Studio-Teile sehen im Code so aus wie ihr gemergter Entwurf und sind „fertig“.
Jetzt kommen die Themen für nach dem MVP. Sie stehen unten in fünf Listen (A bis E). Jeder Eintrag hat eine Nummer,
damit wir ihn abhaken können. Die Quelle (Befund oder Q) steht in `design-to-code.md`, „dl“ heißt
`backlog-parallel/decisions-latest.md`.

## Regeln

1. Jedes Ding gibt es nur einmal: ein Canvas, ein Picker, keine Kopien.
2. Jeder Fehler wird zuerst ein Test, dann wird er behoben.
3. Werkzeug-Fixes sind allgemein: sie helfen jedem Projekt, nicht nur Studio.
4. Ein Produkt-Thema (Liste A) startet erst, wenn Tom seine Reihenfolge festgelegt hat. Braucht es einen Entwurf, kommt
   zuerst der Entwurf (Liste E).
5. Der Builder wartet nicht auf Tom. Tom bekommt eine kurze Runde, wenn er da ist: höchstens 3 Fragen.

## Gerade in Arbeit

Builder, allgemeine Werkzeug-Fixes ohne Entwurf (B21, C1).

## Erledigt

- B14 und B15: `design compare --live` meldet Rahmen unter einem Panel als OCCLUDED und wartet auf Overlay-Animationen (cf2565685, 02.11.).
- B22: Ein Fehlschlag in `design actions` nennt den erreichten Zustand oder den nächsten. Offen: Fehlschläge, die nur aria-expanded prüft (a01d37d64, 02.11.).
- B20: `task --verify` führt die Aktions-Prüfung aus und bricht bei einem Fehlschlag ab (1855d1bc4, 02.11.).
- MVP: alle 17 Teile fertig (02.11.).
- Schnellere Design-CLI: Aktions-Prüfungen laufen parallel und warten auf eine Bedingung statt fester 400 ms;
  shell-main jetzt 80 s statt 322 s (Q16, 02.11.).
- Änderungen ohne sichtbaren Unterschied machen ein Go nicht mehr ungültig (Q15, 02.11.).
- Ein Canvas für System, Sketches und Canvas-Rahmen; Fokus-Rahmen nur bei Tastatur (01.11. und 02.11.).

## A. Studio: was man sieht

1. Eigene Titelleiste (Windows, Linux; macOS behält die Ampel-Knöpfe).
2. Suche in der Titelleiste; Klick oder Strg+K öffnet die Command Palette.
3. Knopf „Update“ in der Titelleiste, nur wenn ein Update bereit ist (Q90).
4. Arbeit (Rendern, Mergen) nur in der Ansicht zeigen, auf die man wartet.
5. Seitenleiste: Repo-Wechsel und „Projekt öffnen“ ins Logo-Menü; oben die Auswahl der Design-Systeme; die Auswahl
   unten entfällt.
6. Schnellwahl in der Leiste zeigt Logo oder zwei eindeutige Buchstaben, mit Tooltip (Q21).
7. Breite der Seitenleiste mit der Maus ziehen (Q133).
8. Tooltips aus ethlete/components statt nativer `title`-Tooltips (Befund 116).
9. Merge-Ansicht wieder mit Canvas und Zoom (Befund 117; Entwurf in E1).
10. Go überarbeiten: „Go geben“ und „Änderung abnehmen“ nebeneinander verwirren; neuer Name für „Go“ (Befund 109; E2).
11. „Go geben“ nur, wenn alle Prüfungen grün sind, sonst steht da, was fehlt (Q14).
12. Go bleibt gültig, wenn sich nur die Verknüpfung zum App-Code ändert (Q28).
13. Sketch „gewählt, aber nicht gemergt“ sichtbar machen oder beides in einem Schritt.
14. Hinweis an Sketches, die sehr wahrscheinlich automatisch mergen.
15. Kopf eines Sketches mit mehreren Teilen: Titel und „n Teile“ zum Aufklappen (Q244).
16. Offene Punkte: veraltete Sketch-Basis, Sketch mit Namen, Entscheidung offen bis gebaut (Befunde 92, 93, 94).
17. Teil-Baum behält die Scroll-Position beim Neuladen (Befund 99).
18. Kommentar-Pins auch für gemergte Sketches und erledigte Kommentare in Sketches (Befund 122).
19. Inbox: echte Benutzer statt „Du“, Zustand „unterbrochen“, echte Fehlermeldung (Q18, Q19, Q26).
20. Eigener Baum für Sketches und Flows; Abschnitte im Teil-Baum (Q22, Q60).
21. Sketch-Ansicht: Variante ablehnen und wieder öffnen, Notizen, Diff-Listen – kommen sie zurück? (Q55; E7)
22. Flows: Pins, Notizen, Entwürfe, `jumpTo`; richtiges Seitenverhältnis je Preset; der eine Canvas (Q66, Q75, Q125).
23. „Verwerfen“ mit Rückfrage (Q70).
24. Merge-Seite zeigt alle unveränderten Teile, nicht nur das erste (Q72).
25. Chat, Notizen und Knöpfe oben rechts kommen zurück, je mit Entwurf (Q81).
26. Studio-Menü: Einstellungen, Erscheinungsbild, Tastenkürzel, Hilfe, Über Studio (Q83).
27. Server-Status: Neu laden, „veraltet“, Neustart, Stopp (Q88); „Scan“ für Checkouts (Q89).
28. Popup „Ausnahmen N“ und alte Ansicht für Calls neu gestalten (Q91, Q92).
29. Inventar überarbeiten: als Canvas, Assets, offene Overlays, Einstieg, Knopf „Alle Produkte“ (Q100, Q101, Q233,
    Q239).
30. Zeilen im Popup „Offene Punkte“ anklickbar.
31. Gleiche Darstellung aller Zellen im Raster mit Live-iframes; vorher Kosten messen.
32. Sketch zeigt bei einer Änderung auch die Nachbarschaft (ganze Zeile, Zelle markiert).
33. Zwei Designer in einem Projekt (E8).
34. Übersetzung (i18n); die deutsche Label-Liste ist der Anfang (Q42).
35. Motion-Editor.

## B. Design-CLI: neue Prüfungen

1. Ein Teil wird eingebettet, nicht nachgezeichnet; ein App-Component je Teil; `--live` prüft ein Teil auf jeder
   Seite (Befunde 84, 85).
2. `--live` meldet fertige Teile, die keine Seite zeigt (Befunde 89, 91).
3. Prüfung bei breiterem Fenster: feste Breite in einem wachsenden Bereich (Befund 90).
4. Hover-Zustand im Vergleich (Befund 96).
5. Scroll-Position nach Neuladen prüfen (Befund 99).
6. Größenänderung pro Canvas prüfen (Befund 100).
7. SDK-Teile erben Schrift und Fläche richtig; Warnung bei veraltetem dist (Befund 101).
8. Wiederholte Gruppen brauchen ein Control (Befund 102).
9. Eine Token-Datei je SDK-Komponente; lokale Überschreibung wird gemeldet (Befund 103).
10. Beispiel-Inhalt markieren (`data-et-demo`) und in App-Code finden (Befund 104).
11. Lint-Regel gegen native `title` (Befund 116).
12. Asynchrone Aktionen: Zustand „pending“, zweiter Klick tut nichts (Befund 106).
13. Radius eines Controls passt zum Kind, das es füllt (Befunde 107, 119).
14. OCCLUDED: Rahmen unter einem festen Panel (Befunde 120, 129). **Erledigt** (cf2565685).
15. Vergleich wartet auf die Animation eines Overlays (Befund 129). **Erledigt** (cf2565685).
16. Eine getestete Offset-Hilfe für Fit und Kamera (Befund 129).
17. Zustände auch mit echten, großen Daten prüfen (Befund 118).
18. Jede Zeilen-Variante drücken, auch hinter einem Schalter (Befund 121).
19. `emit:`-Aktion prüft auch, was der Host daraus macht (Befund 113).
20. `task --verify` führt die Aktions-Prüfung aus (Befunde 123, 127). **Erledigt** (1855d1bc4).
21. Ändert sich ein eingebettetes Teil, müssen die Aktionen der umgebenden Teile neu laufen (Befund 130). **Läuft.**
22. „Erreicht Zustand X statt Y“ bei einem Fehlschlag; Ziel passt zum Start (Befund 131). **Erledigt** (a01d37d64).
23. Eine Vergleichsregel für die Ecken der SDK-Panels (Q51).
24. Harness erzeugt die Tailwind-Klassen der Entwürfe selbst (Q50).
25. `design dom <part>` gibt das HTML eines Teils aus.
26. Einfaches `design check` zeigt jeden Blocker, nicht erst `design ready`.
27. Kanonische Tailwind-Klassen im App-Code prüfen.
28. Ein Teil darf seine Größe nicht vom Inhalt eines Slots nehmen (Q47).

## C. CLI: Tempo und Ablauf

1. Harness-App nicht bei jedem Befehl neu bauen, spart etwa 11 s pro Lauf (Q16). **Läuft.**
2. `design actions` gibt jedes Ergebnis sofort aus, nicht erst am Ende (Befund 111).
3. Pre-push führt die Studio-Tests der geänderten Dateien aus (Befund 124).
4. `design check` schneller machen, heute etwa 6:30 für Studio (Q23).
5. Pre-push prüft geänderte Teile statisch (Befund 105).
6. Jedes Warten der CLI hat ein Limit und sagt, worauf es wartet (Befund 114).
7. Studio-App ohne Lint-Warnungen; danach ist jede neue Warnung ein Fehler.

## D. SDK und Libs

1. libs/components: 71 Import-Zyklen auflösen (Q116).
2. Controls der fünf SDK-Teile carousel, scrollable, match, table, bracket.
3. Fokus-Rahmen als API: `focusRingStyles`, öffentliche Tokens (E11).
4. SDK-Teil `checkbox` (Studio nutzt noch die native Checkbox).
5. Eigener Sketch für ein randloses, gedämpftes Select (Q231).
6. Rahmen von `components/floating-action` (E10).
7. Button-Farben gibt es zweimal (Design-Teil und libs/components); Checkbox und Radio-Group nachziehen.
8. Aktive Farbe in icon-button und split-button (Q245), vielleicht schon erledigt.
9. Studio: 8 Teile ohne App-Code; canvas-frames und studio-view sauber zuordnen (Q247, Q248).
10. Die Matrix „Aktuell“ nur einmal, für App und CLI (Q124).
11. 48 SDK-Teile haben noch offene Punkte.

## E. Fragen und Entwürfe für Tom

1. Merge-Ansicht: Canvas wie System oder statisch?
2. Go: ein Schritt pro Änderung oder feste Reihenfolge? Und welcher Name statt „Go“?
3. Logo-Knopf: Radius bei Hover und Active (Befund 107).
4. Schnellwahl: welche zwei Buchstaben, woher kommt das Logo?
5. Titelleiste unter Windows und Linux: Knöpfe zeichnen.
6. Entwürfe vor der Rückkehr: Chat, Notizen, Menü-Einträge, Server-Status, Scan, Update-Hinweis, „Ausnahmen N“,
   Inventar-Einstieg, „Alle Produkte“.
7. Sketch-Ansicht: kommen Ablehnen, Notizen und Diff-Listen zurück, und wo?
8. Zwei Designer: was muss ein Designer sehen? Tom denkt an Echtzeit wie in Figma.
9. Live-iframes im Raster und Nachbarschaft im Sketch: erst messen, dann entscheiden.
10. `floating-action`: Normalisierung erweitern oder `fa-page` behalten?
11. Öffentliche Fokus-Rahmen-Tokens: SDK-API-Entscheidung.
12. canvas-frames umbenennen und mit shell-main verknüpfen (Q248).
13. Toms gesammelte Runde nach dem MVP (Q25, Q38): Status und Kommentar-Zahlen im Baum, Problemtext als Warnung,
    deutsche Tooltips am Zoom-Chip (Q41).
14. Was zählt als „sehr wahrscheinlich automatisch gemergt“?
