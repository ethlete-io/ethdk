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
- S2 (fifagg, 19.11.): Stärke je Zone in `et-standings`, nicht blockiert -> Standings-Zonenstärke (B620).
- S3 (fifagg, 19.11.): Tooltip der Form-Einträge mit eigenem Inhalt, nicht blockiert -> Standings-Form-Tooltip (B621). Ausblick ohne Anfrage: Status-Slot je Zeile ("Qualified"-Badge), sobald die Gruppentabellen auf `et-standings` wechseln.
- S4 (fifagg, 19.11.): `et-segmented-button-group` direkt in `et-scrollable` (item-size auto) fällt zusammen (Gruppe 6 px, Label 0 px), Umgehung `w-max` in 7 Templates, gebaut (B622, 615a6dab7), kommt mit dem nächsten Prerelease; danach kann fifa `w-max` entfernen.
- S5 (fifagg B-52/B-53, 19.11.): Look der Segment-Gruppe: inaktive Farbe/Stärke und Spur-Hintergrund, Spaltenbreite bei `stretch` ohne abgeschnittene Namen, 2x2 unter einem Breakpoint; nicht blockiert (Umgehungen) Segment-Gruppe-Tokens gebaut (B623, 2e89fe206), kommt mit dem nächsten Prerelease.
- S6 (fifagg B-51/B-55, 19.11.): `et-accordion` ohne Hover-Fläche, Chevron-Einzug getrennt vom Label, Trenner unter dem letzten Eintrag app-weit; nicht blockiert Accordion-Tokens und `provideAccordionConfig` gebaut (B624, 8a44517b7), kommt mit dem nächsten Prerelease.

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
