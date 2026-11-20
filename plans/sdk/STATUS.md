# SDK - Status

Stand: 18.11.2026

Das SDK sind die veröffentlichten `@ethlete/*`-Bibliotheken unter `libs/`. Die Arbeit läuft in der Builder-Warteschlange
(ADR 0355), die Zeilen stehen in [`plans/studio/STATUS.md`](../studio/STATUS.md). Hier stehen sie nicht
doppelt. Es gibt keine eigene SDK-Warteschlange.

## Consumer-Anfragen

Eine Sitzung in einem anderen Repo, das das SDK nutzt (zuerst fifagg), meldet SDK-Wünsche gebündelt in einem festen
Format: was fehlt, wie man es nachstellt, was sie solange tut, ob sie blockiert ist (ADR 0370). Jede Anfrage wird hier
eine Zeile `S<n>` und bekommt einen Eintrag in der Builder-Warteschlange (ADR 0355: eine Liste laufender Arbeit). Nur
eine blockierte Sitzung unterbricht sofort.

- S1 (fifagg, 18.11.): fünf Tokens/Looks für waagerechtes `et-progress-steps`, gebaut (B617, 209d65db7), kommt mit dem nächsten Prerelease (frühestens 20.11.).
- S2 (fifagg, 19.11.): Stärke je Zone in `et-standings`, nicht blockiert, gebaut (B620, ec0193c71), kommt mit dem nächsten Prerelease.
- S3 (fifagg, 19.11.): Tooltip der Form-Einträge mit eigenem Inhalt, nicht blockiert, gebaut (B621, c6acf3d7e, 363e70eeb, 568da78b8), kommt mit dem nächsten Prerelease. Ausblick ohne Anfrage: Status-Slot je Zeile ("Qualified"-Badge), sobald die Gruppentabellen auf `et-standings` wechseln.
- S4 (fifagg, 19.11.): `et-segmented-button-group` direkt in `et-scrollable` (item-size auto) fällt zusammen (Gruppe 6 px, Label 0 px), Umgehung `w-max` in 7 Templates, gebaut (B622, 615a6dab7), kommt mit dem nächsten Prerelease; danach kann fifa `w-max` entfernen.
- S5 (fifagg B-52/B-53, 19.11.): Look der Segment-Gruppe: inaktive Farbe/Stärke und Spur-Hintergrund, Spaltenbreite bei `stretch` ohne abgeschnittene Namen, 2x2 unter einem Breakpoint; nicht blockiert (Umgehungen) Segment-Gruppe-Tokens gebaut (B623, 2e89fe206), kommt mit dem nächsten Prerelease.
- S6 (fifagg B-51/B-55, 19.11.): `et-accordion` ohne Hover-Fläche, Chevron-Einzug getrennt vom Label, Trenner unter dem letzten Eintrag app-weit; nicht blockiert Accordion-Tokens und `provideAccordionConfig` gebaut (B624, 8a44517b7), kommt mit dem nächsten Prerelease.
- S7 (fifagg VD, 19.11.): Filter-Chip soll beim Drücken outline bleiben (Rand + Text in pressedColor), `et-button` macht outline gedrückt zu filled; nicht blockiert, gebaut (B625, b164e6139), kommt mit dem nächsten Prerelease, entschieden von mir: Zustand über Inputs (AGENTS.md Styling), Input `pressedVariant`.
- S8 (fifagg, 19.11.): Segment-Gruppe bei 390 px mit 4 vollen Namen, nicht blockiert (eine gekürzte Zeile) -> Segment-Gruppe Überlauf (B628), entschieden von mir: Input `overflow` truncate | scroll.
- S9 (fifagg, 19.11.): Accordion: Hover-Fläche breiter als Trenner, Tönungs-Abstand, Chevron-Farbe/Stärke, Panel-Abstand oben; nicht blockiert -> Accordion-Tokens 2 (B629), entschieden von mir wie B624.
- S10 (fifagg NX-4, 19.11.): Icon-Aliase aus `metadata/icons.yml` im Icon-Generator, blockierte Glyphen, gebaut (d306d3007), kommt mit dem nächsten Prerelease; echte FA6-Installation meldet fifa danach.
- S11 (fifagg, 19.11.): Formfeld-Label-Farbe ohne öffentliches Token, nicht blockiert -> Formfeld-Label-Token (B630), entschieden von mir wie B624.
- S12 (fifagg NX-11, 19.11.): Fortschritts-Marker „upcoming“: Zahl ausblenden (Prod: leerer Ring) und eigener Hintergrund, nicht blockiert -> Fortschritt-Tokens 2 (B631), entschieden von mir wie B624. B617 und S10 kommen mit dem Prerelease ab 20.11. (ADR 0377, Doc-Agent mergt).
- S13 (fifagg NX-7, 19.11.): Accordion-Hover als Unterstrich statt Tönungsfläche, nicht blockiert -> Accordion-Unterstrich-Hover (B632), entschieden von mir wie B624.
- S14 (fifagg, 20.11.): Pip-Rand bei versteckter Titelleiste, blockiert -> Pip-Rand bei versteckter Titelleiste (B649).
- S15 (fifagg, 20.11.): Scrollable-Buttons app-weit, blockiert -> Scrollable-Buttons app-weit (B650).
- S16 (fifagg, 20.11.): Sticky-Kind über dem Scroll-Fade, blockiert -> Sticky-Kind über dem Scroll-Fade (B651).
- S17 (fifagg, 20.11.): Pagination scrollt nur nach oben, blockiert -> Pagination scrollt nur nach oben (B652).
- S18 (fifagg, 20.11.): Carousel mit einer Folie, nicht blockiert -> Carousel mit einer Folie (B653).
- S19 (fifagg, 20.11.): Segment-Gruppe im Scrollable, nicht blockiert -> Segment-Gruppe im Scrollable (B654).
- S20 (fifagg, 20.11.): et-label in et-dropzone, nicht blockiert -> et-label in et-dropzone (B655).
- S21 (fifagg, 20.11.): Dropzone resolveExisting mit Bild-Varianten, nicht blockiert -> Dropzone resolveExisting mit Bild-Varianten (B656).
- S22 (fifagg, 19.11.): Tab-Unterstrich in Label-Breite, nicht blockiert -> Tab-Unterstrich in Label-Breite (B657).

## Offene Plan-Dateien

- [`e2e-failure-triage.md`](./e2e-failure-triage.md): offen ist nur `et e2e slices` (Slice-Runner im `@ethlete/cli`).
  Reporter, Skill und Mod sind gebaut.
- [`fifagg-sdk-findings-2026-11-15-seo.md`](./fifagg-sdk-findings-2026-11-15-seo.md): zwei Befunde aus der SEO-Migration
  von fifagg (Titel-Priorität, Head-Store-Schreiben in `effect`), noch nicht gegen `next` geprüft.

## Offene Fragen an den Menschen

- Sollen Stories später die Docs-Beispiele aus `apps/docs-examples` rendern, damit es jede Demo nur einmal gibt? (offen
  aus dem alten Plan `docs-examples.md`, ADR 0360)

## Verweise

Entscheidungen: [`apps/ethlete-studio/docs/adr/`](../../apps/ethlete-studio/docs/adr/), zuletzt 0359 (query v3),
0360 (Docs-Beispiele), 0361 (Farbe: Surface und Akzent). Docs: `apps/docs`.
