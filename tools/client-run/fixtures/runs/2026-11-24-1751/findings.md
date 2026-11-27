# Kunden-Vorlauf 2026-11-24-1751

Lauf: `/home/tom/dev/client-runs/2026-11-24-1751`. 3 Befunde, 65 Bilder nicht geprüft (Grenze 150).

- components/button Variante a: Zustände icon-tonal, icon-transparent-active sehen gleich aus. Verdacht: Zustand zeichnet keinen sichtbaren Unterschied. (`shots/components-button_a_components-button_icon-tonal.png`)
- components/button Variante b: Zustände pressed-hover, pressed-active sehen gleich aus. Verdacht: Zustand zeichnet keinen sichtbaren Unterschied. (`shots/components-button_b_components-button_pressed-hover.png`)
- components/button Variante b: Zustände filled-hover, pressed-hover, pressed-active zeigen dasselbe Bild, nur der Text ist anders. Verdacht: Jeder Zustand ändert nur seine Überschrift und zeichnet nicht, wofür er steht. (`shots/components-button_b_components-button_filled-hover.png`)

## Schlussnachricht des Agenten

Alle sechs Sketches liegen in Studio zur Wahl bereit. Ich habe nichts übernommen und nichts committet. Das Werkzeug hat nichts abgelehnt, das sich nicht in den Design-Dateien lösen ließ.

| Teil | Varianten | Mein Vorschlag |
|---|---|---|
| Farben | nur A: Nachtblau mit Türkis wie im alten Katalog | A |
| Marken-Logo | A altes gefaltetes T + OMFLIX · B T als App-Icon + „Tomflix“ · C T als Filmstreifen | B, weil es als App-Icon taugt und auch klein lesbar bleibt |
| Button | A runde Pillen wie im alten Katalog · B Kinolook mit weißem Hauptbutton · C kompakt mit 12px-Ecken | A, weil er den „Filter“-Button des alten Katalogs übernimmt |
| App Shell | A Suchleiste in der Mitte wie im alten Katalog · B Streaming-Kopfzeile mit Textnavigation · C Seitenleiste | A |
| Hero | A Rahmen mit Farbschein aus dem Bild und Plakat · B Bild über die volle Breite · C ruhiges, zentriertes Panel | A |
| Titelkarte | A Hochformat-Plakat mit Logo unten · B Querformat-Bild mit großem Logo · C Plakat, das beim Überfahren das Logo einblendet | A, weil Titel, Infozeile und Hinweis wie „Neu“ oder „4K“ ohne Überfahren sichtbar sind |

Ohne Logo zeigt die Karte den Titel als Text, zum Beispiel bei „John Williams: Live in Vienna“. Hero und Titelkarte zeigen außerdem einen Film ohne Plakat („Vortex“).

Was dir beim Wählen auffallen wird:
- **Farben:** Ich hatte zusätzlich ein neutrales Schwarz gezeichnet. Das Werkzeug hat es abgelehnt, weil es sich vom Nachtblau kaum unterscheidet, deshalb habe ich es zurückgezogen.
- **Buttons in Shell und Hero:** Sie erscheinen noch im Standard-Look der Bibliothek, nicht als Tomflix-Pille. Das Werkzeug zeichnet dort keine offene Button-Sketch, die Pille kommt erst, wenn du einen Button übernimmst.
- **Löschen-Button:** Er ist türkis statt rot, weil das Produkt noch keine Warnfarbe hat.
- **Logo von „Vortex“:** Es ist schwarz und auf der Karte nur über eine feine helle Kontur lesbar.

Offen:
- **Typfehler:** Jede Prüfung meldet Typfehler in den Zeichnungen, die mit der Bibliothek ausgeliefert werden. Wahrscheinlich passen deren Versionen nicht zusammen. Die Freigabe hat das nicht verhindert, es sollte aber behoben werden.
- **Bilder:** Ich habe sie direkt in den Bildordner des Produkts gelegt und nicht in einen Sketch.
- **Produkt-Stylesheet:** Damit die Tailwind-Klassen in den Zeichnungen ankommen, wurde dort eine Zeile ergänzt.
- **Tab-Leiste:** Die untere Tab-Leiste der Shell sollte später ein eigenes Bauteil werden.
- **Logo-Details:** Abstände, Mindestgröße und Farbvarianten zeichne ich erst, wenn du ein Logo gewählt hast.
