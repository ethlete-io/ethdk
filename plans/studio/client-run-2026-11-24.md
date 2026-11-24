# Kunden-Vorlauf 2026-11-24 (B687, erster Lauf)

Lauf: `yarn client-run --sdk <gebaute SDK-Kopie>` (Kopie in `~/dev/client-runs/2026-11-24-0056`), ein Teil
(Titelkarte), Bildsatz mit 12 Titeln (11 mit Logo, 1 ohne). Der Agent meldete „Sketch fertig, drei Varianten,
alle richtig dargestellt“ und ließ keine Ablehnung offen; `sketch ready` lief durch.

## Befunde

- Einzelbild jedes Zustands der Varianten b und c ist ein schwarzes 48x48-Quadrat (`/__design/shot?...&sketch=&variant=b&priority=low`), der Bogen des Agenten zeigt b und c richtig. Verdacht: Einzel-Shot einer Sketch-Variante ungleich a findet den Teil nicht und zeichnet einen Platzhalter (Suspect, nicht bestätigt).
- Alle Karten stehen auf hellem Grund, obwohl Tomflix dunkel ist; der Agent schreibt selbst „Tomflix hat noch keine eigenen Farben“. Verdacht: das Start-Setup (`overlays/tomflix`) bringt nur `base` und keine Farb-Grundlage, das Werkzeug fordert keine an.
- Variante a: Dune-Logo blass und klein unter dem Plakat, der Titel steht doppelt (Plakat trägt ihn schon). Verdacht: der Auftrag nennt das Plakat-Motiv nicht, das Werkzeug meldet doppelte Titel nicht.
- Varianten b und c: orangefarbenes Logo auf weißem Verlauf kaum lesbar. Verdacht: kein Kontrast-Check für Bild-auf-Bild (Logo auf Hintergrund).
- Variante a: im Einzelbild sehen `logo` und `logo-focus-visible` (ebenso `fallback`) gleich aus, im Bogen trägt focus-visible einen Ring. Verdacht: der Einzel-Shot schneidet auf die Inhaltsbox und verliert den äußeren Fokus-Ring.
- Rückfall ohne Logo (John Williams) zeigt den Titel als Text: wie bestellt, kein Befund.

## Offen (nächste Schritte)

- Prüfer: Fehl-Bilder (`<img>` ohne Datei) und kaputten Text erkennen; abgeschnittene Rahmen; Baum (`/__design/system`) gegen Sketch-Ziele prüfen.
- 48x48-Befund auf dem echten Fall nachstellen (Spec rot ohne Fix), erst dann Fix.
- Cron/Builder-Start: `yarn client-run` braucht ohne `--sdk` einen Scratch-Bau (`yarn scratch:checkout` + `nx build cli agent-rules`), ca. 5 min.
