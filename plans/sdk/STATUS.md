# SDK - Status

Stand: 21.11.2026

Das SDK sind die veröffentlichten `@ethlete/*`-Bibliotheken unter `libs/`. Die Arbeit läuft in der Builder-Warteschlange
(ADR 0355), die Zeilen stehen in [`plans/studio/STATUS.md`](../studio/STATUS.md). Hier stehen sie nicht
doppelt. Es gibt keine eigene SDK-Warteschlange.

## Consumer-Anfragen

Eine Sitzung in einem anderen Repo, das das SDK nutzt (zuerst fifagg), meldet SDK-Wünsche gebündelt in einem festen
Format: was fehlt, wie man es nachstellt, was sie solange tut, ob sie blockiert ist (ADR 0370). Jede Anfrage wird hier
eine Zeile `S<n>` und bekommt einen Eintrag in der Builder-Warteschlange (ADR 0355: eine Liste laufender Arbeit). Nur
eine blockierte Sitzung unterbricht sofort.

- S1-S7, S10 (fifagg, 18.-19.11.): gebaut (B617, B620-B625, d306d3007), kommen mit dem nächsten Prerelease (ADR 0377).
- S8, S9, S11-S13 (fifagg, 19.11.): nicht blockiert, entschieden von mir wie B624 -> B628-B632.
- S14-S17, S23-S25 (fifagg, 20.11.): blockiert -> B649-B652, B657; gebaut, gehen mit dem nächsten Push raus.
- S18, S19, S22 (fifagg): nicht blockiert -> B653, B654, B657; gebaut.
- S20, S21 (fifagg, 20.11.): kein SDK-Code: cdk-Label statt components (B655), Bild-Varianten gehören zu fifagg (B656); fifagg informiert.
- S26 (fifagg, 20.11.): blockiert, = S17 (B652), ausgeliefert in components 1.0.0-next.92; fifagg informiert.
- S27 (fifagg, 20.11.): nicht blockiert, Match-Teilnehmer bearbeitbar + Score/Zeit-Baustein -> B659.
- S28, S29 (fifagg, 21.11.): ausgeliefert in components 1.0.0-next.94 (Scroll-Buttons: Farbe/Variante app-weit, Abstands-Variablen, Eingabe `scrollableButtons`, Breakpoint-Maps blenden unterhalb aus); fifagg informiert.
- S30-S36 (fifagg, 21.11.): ausgeliefert in @ethlete/components 1.0.0-next.95; fifagg informiert.
- S37 (fifagg, 21.11.): ausgeliefert in @ethlete/components 1.0.0-next.96 (cf03fdca1, 22.11.), fifa informiert; war blockiert (88 visuelle Rots): der Pfeil im gefüllten Scroll-Button nimmt `--et-surface-interaction-solid` statt der Tinte des Buttons (grau statt weiß auf fifa-dark); Fix im SDK: gefüllter Button zeichnet das Icon in seiner Tinte -> Builder sofort, Prerelease danach (ADR 0377).
- S38 (fifagg, 22.11.): ausgeliefert in @ethlete/components 1.0.0-next.98 (08251f2d5); war blockiert: Formularfeld ohne Label mit floating-Label-Modus blendete den Platzhalter aus.
- S39 (fifagg, 22.11.): nicht blockiert, kein SDK-Code: `fill="sunken"` ist der dokumentierte Weg für ein vertieftes Feld; die Höhe kommt aus dem App-Token, das nur `data-fill=filled` trifft; fifagg informiert.
- S40 (fifagg, 22.11.): ausgeliefert in @ethlete/components 1.0.0-next.98 (4103379e9): Variable `--et-form-field-floating-inside-control-font-scale` (Standard 0.96).
- S41 (fifagg, 23.11.): kein SDK-Code: die Größen-Höhen sind ein Minimum (forms.md); fifaggs 9 px padding-block ergibt bei Skala 1 50,5 px. Antwort: padding-block 0.875rem oder Skala 0.96; Guide ergänzt 52e4f7310; fifagg bestätigt 50 px (B669 geschlossen).
- S42 (fifagg, 23.11.): kein SDK-Code: der `data-text-shell`-Block in select.css wurde absichtlich entfernt (6f86022cf: ein Feld behält seinen Rand, außer bei ghost); Ersatz `variant="ghost"`; fifagg informiert.
- S43 (fifagg, 23.11.): war blockiert -> B671: kein SDK-Code; vorhandene Tokens `--et-button-line-height` + Block-Padding je Breakpoint geben exakt 50/65 px (Mindesthöhe hätte ein inneres Element gebraucht = breaking); fifagg bestätigt 50/65 px auf allen 9 Buttons (B671 geschlossen); Guide 0a507354a.
- Dialog (Studio, 21.11.): die Dialog-Overlay-Strategie zentriert die Pane auf Bruchpixeln (302,5 px hoch -> top 40,25), was Textzeilen abwechselnd rundet (shortcuts-dialog 1694 px, die echte App zeigt es auch); Suspect bis zum Biss; Fix: ganzzahlige Zentrierung in der Strategie.

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
