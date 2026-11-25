# Theming-Revision (B757)

Stand: 26.11.2026. Status: **Triage, Entscheidungen offen.** Kein Builder-Start vor Abschluss der
Entscheidungen in Abschnitt 6.

Zahlen stammen aus drei Suchläufen (Sonnet-Subagenten) vom 25.11. Tragende Aussagen sind per
Stichprobe an der Quelle geprüft und mit ✔ markiert; alle anderen Zahlen sind Größenordnungen.
Gegenprüfung durch Codex (gpt-6.2-astra) am 26.11.; jeder übernommene Punkt ist an der Quelle
nachgelesen und mit ✔ markiert.
Konsumenten: fifagg (`fifagg-frontend`, core next.79, components next.100) und fut-frontend
(core next.61, components next.66).

## 0. Befund in fünf Sätzen

1. Die **Defaults** der Komponenten funktionieren über Ebenen: fast alle mischen
   `--et-surface-interaction-solid` durchscheinend über die Fläche. Der Bruch in fifagg B-65 kommt
   nicht aus dem Default, sondern aus dem öffentlichen Token
   `--et-accordion-header-hover-background`, das eine **absolute Farbe** annimmt ✔.
2. Es gibt trotzdem kein Modell: 51 CSS-Dateien mischen von Hand, mit 24 verschiedenen
   Prozentwerten (4 bis 85 %) ✔. Hover ist je nach Komponente 6, 7, 8, 10 oder 12 %.
3. Etwa zehn Komponenten bieten ein Zustands-Token an, das zu einer absoluten Farbe einlädt
   (Accordion, Select-Option, Select-Panel-Aktion, Segmented-Button, Carousel, Scrollbar, Table,
   Button outline/transparent, Pagination, Form-Field). Die Button-Doku empfiehlt sogar
   `rgb(40 49 64)`.
4. `interactionColor` trägt drei Rollen in einem Feld: Text- und Icon-Leiter für neutrale
   Bedienelemente (Tabs, fut-Utilities), Tönungsquelle für Flächen (die 51 Dateien) und Palette der
   reservierten Farbe `surface`. Das ist der Kern des Wildwuchses.
5. Die Apps bauen „Hover = nächste Ebene“ von Hand: fifagg etwa 180 Tailwind-Klassen
   (`hover:bg-gg-dark-3` ×79 auf `bg-gg-dark-2`) und drei Accordion-Deklarationen insgesamt:
   `:root` → gg-dark-2, Raised → gg-dark-3, Card → gg-dark-4 (Notlösung 4c9e9e3c41 ✔). Inset
   (Ebene −1) und Float (Ebene 3) haben keine eigene Zeile und erben ✔.

## 1. Bestand

Urteil: **B** behalten, **Z** zusammenlegen, **E** entfernen. Nutzer = Dateien Produktivcode
(ohne Specs, Stories, Doku).

### 1.1 Kontext und Direktiven (`libs/core/src/lib/theming/`)

| Mechanismus                                                                                                                    | Ort                                                                  | Nutzer                                                                                                       | Überschneidung                                                                     | Urteil und Grund                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ProvideSurfaceDirective`, `etProvideSurface`, `SURFACE_PROVIDER`                                                              | provide-surface.directive.ts:223                                     | components 12, cdk 2, core 7; Apps 0 direkt; fifagg 5, fut 11                                                | mit `etAutoSurface`                                                                | **B**. Einzige Quelle des Surface-Scopes.                                                                                       |
| `AutoSurfaceDirective`, `etAutoSurface`                                                                                        | auto-surface.directive.ts                                            | components 13, cli 2, studio 12; fut 15                                                                      | setzt denselben Scope, wählt Ebene +1                                              | **B**. Ist der Normalfall in Apps; `etProvideSurface` bleibt für den festen Namen.                                              |
| `ProvideColorDirective`, `etProvideColor`, `COLOR_PROVIDER`, `forceColor`, `syncWithProvider`                                  | provide-surface.directive.ts:71                                      | components 92, cdk 14, devtools 4, studio 18, timetrack 6; fifagg 94, fut 432                                | liegt in der Surface-Datei                                                         | **B**, Datei teilen (rein intern, kein API-Bruch).                                                                              |
| `SurfaceInteractiveDirective`, `etSurfaceInteractive`                                                                          | surface-interactive.directive.ts                                     | components 2 (ButtonDirective, TabBarTrigger) ✔, studio 8; fifagg 0, fut 0                                   | Button-CSS liest das Ergebnis nicht ✔ (nur Tabs)                                   | **Z**. Bleibt als Text-/Icon-Leiter; die Flächen-Rolle geht in das neue Modell. Vom Button entfernen, wenn Schritt 2 durch ist. |
| `ColorInteractiveDirective` + Container, Exclude, HasFocus                                                                     | color-interactive\*.ts, 147 Zeilen CSS                               | components 22 / 2 / 4 / 1; Apps 0; fifagg 0, fut 0                                                           | Checkbox, Radio, Select-All setzen `--et-color-primary-active` zusätzlich von Hand | **B**. Handgesetzte Doppelungen in Schritt 5 streichen.                                                                         |
| `SurfaceContextTracker`                                                                                                        | surface-context-tracker.ts                                           | components 1, cdk 1                                                                                          | –                                                                                  | **B**. Brücke für abgelöste Overlays.                                                                                           |
| `resolveSurfaceByElevation`, `injectSurfaceType`, `injectParentSurface`, `injectDefaultSurfaceTheme`, `injectRootSurfaceTheme` | surface-theme.util.ts, provide-surface.directive.ts, color-scheme.ts | components 7 / 2 / 3 / 1 / 1, cdk 1                                                                          | fünf Helfer für „welche Fläche“                                                    | **B**, kein Handlungsbedarf.                                                                                                    |
| `provideColorScheme`, `injectColorScheme`                                                                                      | color-scheme.ts                                                      | nur core, Doku, docs-examples                                                                                | –                                                                                  | **B**. Jung, dokumentiert.                                                                                                      |
| `injectSemanticColorTheme`, `resolveColorThemeVariant`                                                                         | semantic-color-theme.ts, color-theme.util.ts                         | components 6, devtools 1, cli 2, studio 16                                                                   | ersetzt die drei veralteten Helfer                                                 | **B**.                                                                                                                          |
| `injectErrorTheme`, `injectWarningTheme`, `injectSuccessTheme` (veraltet)                                                      | semantic-color-theme.ts:71-75                                        | SDK 0; fut 8                                                                                                 | ignorieren die Fläche                                                              | **E** mit Auto-Migration (Schritt 6).                                                                                           |
| `SurfaceTheme.colorTheme`, `.semanticColorThemes` (veraltet)                                                                   | surface-theme.util.ts:57-60                                          | SDK 0                                                                                                        | `colorThemeVariants`                                                               | **E**. Migration `color-theme-variants` existiert (optional); auf required heben.                                               |
| `legacy-theming.ts` (`provideColorThemes`, `createTailwind*`, `createThemeStyle`, `createRootThemeCss`, `createSwatchCss`)     | legacy-theming.ts, 268 Zeilen                                        | Testhelfer `components/testing/color-themes.ts` (71 Specs), `apps/csp`, Migrationsgenerator; fifagg 0, fut 0 | doppelt den Tailwind-4-Weg                                                         | **E**. Zuerst Testhelfer umstellen; `createRootThemeCss` und `createSwatchCss` haben keinen Nutzer.                             |
| `provideColorPalette`, `injectColorPalette`, `injectSurfaceColorPalette`                                                       | color-palette.util.ts                                                | components 5 (Charts, Scheduler), docs-examples                                                              | dritter Farbmechanismus                                                            | **B**. Kategoriale Farben, eigenes Thema; nicht Teil dieser Revision.                                                           |
| `provideRootFontSizeCheck`                                                                                                     | root-font-size-check.ts                                              | nur `tools/testing`                                                                                          | kein Theming                                                                       | **Z**: aus `theming/` heraus verschieben (intern).                                                                              |

### 1.2 Token-Familien

| Familie                                                                 | Definition                                     | Lesestellen                                                                                      | Überschneidung                              | Urteil und Grund                                                                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `--et-surface-{background,color,color-muted,color-subtle,border}-solid` | Alias-Block in `libs/core/design/theme-css.ts` | 830 Vorkommen, 271 Dateien; fut etwa 40                                                          | Roh-Kanäle                                  | **B**. Tragende Schicht.                                                                                             |
| Roh-Kanäle `--et-surface-background` usw. in Komponenten-CSS            | Theme-Klassen                                  | 11 Produktiv-CSS-Dateien in components (Button, Checkbox, Dropzone, Form-Field, Radio, Switch …) | Regelverstoß gegen die Skill-Regel          | **Z**: auf `-solid`/`-rgb` umstellen, Lint-Regel (Schritt 5).                                                        |
| `--et-surface-interaction-solid` / `-rgb`                               | Alias-Block                                    | 148 / 27 Vorkommen; components 59 Dateien; fut 4                                                 | Tönungsquelle **und** Textfarbe             | **Z**. Als Textfarbe bleiben; Flächen lesen künftig das Modell aus Abschnitt 3.                                      |
| `--et-surface-interaction-{hover,focus,active,disabled}-solid`          | Alias-Block, je Scope definiert ✔              | components 8 Dateien (davon 7 nur `disabled` für Text), cli 3; fut 1 + 25 Utilities              | –                                           | **B** als Text-Leiter.                                                                                               |
| `--et-surface-on-interaction*`, `--et-surface-interaction-ink*`         | theme-css.ts, nur über Farbe `surface`         | 0 direkte Leser                                                                                  | –                                           | **B**. Nur Zuträger der Farbe `surface`; aus der öffentlichen Token-Tabelle nehmen.                                  |
| `--et-theme-color-{primary,on-primary,ink}-*`                           | Alias-Block Farbe                              | 419 / 74 / 216 Vorkommen                                                                         | `--et-color-primary*`                       | **B**.                                                                                                               |
| Roh `--et-color-primary*` in Komponenten-CSS                            | Theme-Klassen                                  | components etwa 70 Vorkommen; fifagg 64, fut 92                                                  | zweiter Name derselben Farbe                | **Z** im SDK (Lint). Für Apps bleibt der Name bestehen.                                                              |
| Komponenten-Zustands-Tokens `--et-<komponente>-{hover,active,…}-*`      | je Komponenten-CSS                             | etwa 55 Namen; fifagg setzt 22 mit Zustands- oder Hintergrundbezug, fut 29                       | jedes ein eigenes Mini-Modell               | **Z**: Farb-Tokens für Flächenzustände weg oder auf Stärke umstellen (Entscheidung 3). Text- und Maß-Tokens bleiben. |
| Tailwind-Utilities `*-et-surface-*`, `*-et-theme-*`                     | `@theme`-Block im generierten CSS              | timetrack 68 Dateien, studio 43; fut mit Präfix `fut`                                            | `bg-et-surface-interaction` ×25 ist Vollton | **B**, um Zustands-Utilities ergänzen (Schritt 4).                                                                   |
| cdk-Tokens                                                              | je cdk-SCSS                                    | cdk liest kein Surface-Token; nur Carousel liest `--et-color-primary`                            | –                                           | **B**, unberührt (Wartungsmodus).                                                                                    |

### 1.3 Generatoren, CSS-Erzeuger, Migrationen

| Teil                                                              | Ort                           | Nutzer                                                             | Überschneidung                                           | Urteil und Grund                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `surfaceThemeCss`, `colorThemeCss`, `themeCss`                    | libs/core/design/theme-css.ts | beide Tailwind-4-Generatoren, cli-Spec                             | –                                                        | **B**. Einziger Ort, an dem abgeleitete Tokens entstehen; hier setzt die Revision an.                                         |
| Generator `tailwind-4-surface-theme`, `tailwind-4-color-theme`    | libs/core/generators          | storybook, docs-examples, studio (2 Sätze), timetrack; fifagg, fut | –                                                        | **B**.                                                                                                                        |
| `interactive-styles.ts`                                           | libs/core/design              | 6 Design-Dateien in components                                     | inlined beide Interactive-Sheets                         | **B**.                                                                                                                        |
| `libs/cli/design/web/surface-interactive.css`                     | cli                           | Kopie des core-Sheets, bytegleich ✔, zwei Specs halten sie gleich  | Duplikat                                                 | **Z**: eine Quelle; die Kopie zur Build-Zeit erzeugen. Kleine Aufräumarbeit.                                                  |
| `colors-skeleton.ts` + `tools/scripts/generate-studio-themes.mjs` | cli, tools                    | Studio                                                             | schreibt dieselben Token-Namen von Hand wie theme-css.ts | **Z**: muss das neue Modell mitschreiben, sonst driftet der zweite Schreibweg. Am besten über `themeCss` statt eigener Namen. |
| Migration `surface-interaction-swatch` (auto, next.46)            | migrations.json               | –                                                                  | –                                                        | **B** (historisch nötig für alte Stände wie fut).                                                                             |
| Migration `surface-theme-regenerate` (manuell, next.46)           | migrations/…md                | –                                                                  | wird bei jeder Token-Änderung wieder gebraucht           | **Z**: zu einer wiederverwendbaren „Themes neu erzeugen“-Migration machen, die jeder Schritt mit CSS-Änderung auslöst.        |
| Migration `legacy-color-themes` (assistiert, empfohlen)           | migrations.json               | –                                                                  | –                                                        | **B** bis legacy-theming entfernt ist, dann required.                                                                         |
| Migration `color-theme-variants` (auto, optional)                 | migrations.json               | –                                                                  | –                                                        | **B**, auf required heben, wenn die veralteten Felder gehen.                                                                  |

## 2. Die Lücke: wie Komponenten Zustände heute färben

Spalte „Ebenen“: bleibt der Zustand auf einer anderen Fläche sichtbar, ohne dass jemand etwas
anfasst? „Default ja, Token nein“ heißt: der Default ist durchscheinend, das öffentliche Token
nimmt aber eine absolute Farbe an (das Muster von B-65).

| Komponente                                             | Zustände                        | Mechanismus                                                                                  | Öffentliches Token                                            | Ebenen                                                 |
| ------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Accordion-Kopf                                         | Hover, Aktiv                    | Mix 7 % / 14 % ✔                                                                             | `--et-accordion-header-{hover,active}-background`             | Default ja, Token nein                                 |
| Menüeintrag                                            | Aktiv, Gedrückt                 | privat `--_et-menu-item-*`, Mix 12 % / 20 % ✔                                                | keins                                                         | ja                                                     |
| Select-Option                                          | Hover, Gedrückt, Tastatur-aktiv | Mix 12 % / 20 %                                                                              | `--et-select-option-background-{hover,active}`                | Default ja, Token nein                                 |
| Select-Panel-Aktion                                    | Hover, Aktiv                    | Mix 12 % / 20 %                                                                              | `--et-select-panel-action-background-hover`                   | Default ja, Token nein                                 |
| Cascader-Eintrag, -Breadcrumb                          | Hover, Offen, Fokus             | Mix 12 % / 16 %                                                                              | keins                                                         | ja                                                     |
| Command-Palette-Eintrag                                | Aktiv                           | Mix 12 %                                                                                     | keins                                                         | ja                                                     |
| Tree-Zeile                                             | Hover, Aktiv; Ausgewählt        | Mix 7 % / 14 %; Akzent-Mix 16 / 24 / 32 %                                                    | keins                                                         | ja                                                     |
| Table-Zeile                                            | Hover, Gedrückt, Zebra          | Mix 8 % / 16 % / 4 %; Sticky-Zellen deckend über die Zeilenfläche gemischt                   | `--et-table-row-hover-background`                             | Default ja, Token nein                                 |
| Table-Zeile ausgewählt                                 | Ausgewählt (+Hover, Gedrückt)   | Akzent `light-dark(32 %, 12 %)`, 38/18, 44/26                                                | `--et-table-row-selected-tint`                                | ja (Akzent)                                            |
| Standings-Zeile, Pick-Karte                            | Hover, Aktiv                    | Mix 10 % / 18 %, 12 %                                                                        | keins                                                         | ja                                                     |
| Calendar                                               | Hover, Aktiv; Ausgewählt        | Mix 12 % / 22 %; Akzent deckend                                                              | keins                                                         | ja                                                     |
| Chip                                                   | Ruhe, Hover; Gewählt            | Mix 14 % / 22 %; Akzent-Mix 16 / 24 %                                                        | keins                                                         | ja                                                     |
| Breadcrumb-Overflow                                    | Hover, Aktiv                    | Mix 12 % / 20 %                                                                              | keins                                                         | ja                                                     |
| Eingabe-Knöpfe (Number, Password, Suffix, Sprach-Tool) | Hover, Fokus, Aktiv             | Mix 12 / 16 / 20 %, Suffix 20 / 28 %                                                         | keins                                                         | ja                                                     |
| Checkbox-Option, Radio, Select-All                     | Hover; Gewählt-Hover            | Mix 8 %; `--et-color-primary-active` von Hand                                                | keins                                                         | ja                                                     |
| Segmented-Button                                       | Hover; Gewählt                  | Mix 10 %; Akzent-Alpha 0.08 / 0.12 / 0.16                                                    | `--et-segmented-button-hover-fill`                            | Default ja, Token nein                                 |
| Tabs                                                   | Hover inaktiv; aktiver Tab      | **Textfarbe** über `etSurfaceInteractive`; Akzent-Alpha 0.08 / 0.12 / 0.16                   | `--et-tab-{hover,active,inactive}-color`                      | ja                                                     |
| Button outline, transparent, tonal                     | Hover, Fokus, Aktiv             | Akzent-Deckkraft, Deltas 0.08 / 0.12 / 0.16                                                  | `--et-button-{outline,transparent}-{hover,active}-background` | Default ja, Token nein (Doku empfiehlt absolute Farbe) |
| Button filled, Icon-Button, Split-Button               | Hover, Fokus, Aktiv             | `etColorInteractive` (Theme-Zustandsfarben); Gedrückt mischt 96 % Primär mit On-Primary ✔    | `--et-button-filled-hover-rgb`                                | ja                                                     |
| FAB                                                    | Hover, Fokus, Aktiv             | `::after`-Schicht On-Primary 0.08 / 0.12 / 0.16                                              | keins                                                         | ja                                                     |
| Window-Control-Button                                  | Hover, Aktiv                    | feste Alpha-Werte; Schließen in festem Rot                                                   | `--et-window-control-button-close-*`                          | ja (absichtlich fest)                                  |
| Form-Field-Rahmen                                      | Hover, Fokus                    | Rahmenfarbe über `etColorInteractive`                                                        | `--et-form-field-control-border-color-{hover,focus}`          | Default ja, Token nein                                 |
| Pagination                                             | Hover                           | Rahmenfarbe                                                                                  | `--et-pagination-item-border-color-hover`                     | Default ja, Token nein                                 |
| Carousel-Punkte, Scrollbar-Daumen                      | Hover, Gedrückt                 | Mix 55 / 85 %, 35 / 60 %                                                                     | `--et-carousel-dot-*`, `--et-scrollbar-thumb-*`               | Default ja, Token nein                                 |
| Dropzone                                               | Hover                           | Rahmen liest `--et-surface-interaction-hover-solid` direkt im CSS ✔, Mix 6 %                 | keins                                                         | ja                                                     |
| Match-Card, Time-Picker-Griff                          | Hover                           | deckend über `--et-surface-background-solid` gemischt                                        | keins                                                         | ja, solange die Fläche darunter ein Surface-Scope ist  |
| Bracket-Pick-Card, Scheduler-Termin                    | Hover; Ausgewählt               | Mix 12 %; Akzent-Mix 12 / 20 / 22 %                                                          | keins                                                         | ja                                                     |
| Fokus-Ring                                             | Fokus                           | `.et-focus-ring` (etwa 30 Stellen) **und** 31 CSS-Dateien mit eigenem `outline: 2px solid …` | `--et-focus-ring-{color,offset,width}`                        | ja; zwei Wege, Offsets ±1 bis 3 px                     |
| cdk gesamt                                             | alle                            | feste Farben, Sass `darken()`, Deckkraft, eigene Tokens                                      | je Komponente                                                 | nein, aber außerhalb des Surface-Systems               |

Zählung der Mechanismen: durchscheinender Neutral-Mix (51 Dateien, 24 Stufen; Paare 12/20, 7/14,
8/16, 10/18, 12/22, 12/24, 20/28), Akzent-Alpha-Rampe 0.08 / 0.12 / 0.16 (Button, Tabs,
Segmented, FAB), Akzent-Mix 12 bis 35 % (Tree, Chip, Bracket, Scheduler, Table), deckender Mix
über die Fläche (Table-Sticky, Match-Card, Time-Picker), `etColorInteractive`-Umfärbung,
`etSurfaceInteractive` (schaltet die unsuffigierten `--et-surface-interaction-rgb` / `-solid` je
Zustand um ✔; Leser ist nur der Tabs-Text), reine Deckkraft, eine feste Farbe.
„Nächste Ebene“ nutzt im SDK niemand; nur die Apps.

## 3. Modelle für Interaktions-Flächen

Gemeinsamer Rahmen: Das Modell entsteht einmal in `theme-css.ts` auf `:root` und jedem
Surface-Scope. Komponenten lesen es nur noch. Namen sind Arbeitsnamen.

### Modell A: Zustandsschicht (durchscheinend, Stärke statt Farbe)

Ein Zustand ist eine durchscheinende Schicht der neutralen Tönungsfarbe der Fläche. Stellbar ist
die **Stärke** (eine Zahl), nie die Farbe. Eine Zahl kann nicht mit der Fläche zusammenfallen.

```css
.et-accordion-trigger:hover {
  background: color-mix(
    in srgb,
    var(--et-surface-interaction-solid) var(--et-accordion-header-hover-strength, 7%),
    transparent
  );
}
```

Die Schicht wird **am Verbraucher** gemischt, nicht einmal je Scope: ein auf dem Scope
vorgemischtes Token löst seine `var()` dort auf und sieht eine Stärke, die die Komponente setzt,
nicht ✔ (CSS ersetzt `var()` am deklarierenden Element, vor der Vererbung). Die Komponente bringt
ihre Stärke als Default mit (Accordion 7 / 14 %, Table 8 / 16 %). Deckende Stellen
(Sticky-Zellen) mischen dieselbe Schicht über die tatsächlich gemalte Fläche, wie die Tabelle es
heute tut ✔. Das Modell ist damit eine Formregel (eine Quelle, Stärke statt Farbe, per Lint
erzwungen), kein neuer Token-Satz.

- Funktioniert auf **jedem** Untergrund, auch auf einer von Hand gefärbten Karte ohne
  Surface-Scope (fifagg: `bg-gg-dark-3` etwa 590-mal).
- Aufwand: mittel. Etwa 51 CSS-Dateien, in vier Scheiben; im Generator nur der Ebenen-Baustein.
- Bruch: Themes neu erzeugen nur für den Ebenen-Baustein. Die Stärken bleiben je Komponente, wie sie sind (Vorgabe unten).
  Die farbigen Zustands-Tokens entfallen oder werden Stärken (Entscheidung 3); das trifft fifagg an etwa
  10 Zeilen, fut an keiner.
- Grenze: „Hover ist exakt die Farbe der nächsten Ebene“ geht nicht mehr pixelgenau, nur über
  die Stärke angenähert.

### Modell B: Nächste Ebene (deckend)

Hover ist der Hintergrund des Themes gleichen Typs mit `elevation + 1`, Gedrückt `+ 2`. Der
Generator kennt alle Themes und schreibt den Wert je Scope fest.

```css
.et-surface--fifa-dark-raised {
  --et-surface-hover-background-solid: rgb(31 41 55); /* fifa-dark-card */
  --et-surface-pressed-background-solid: rgb(40 49 64); /* fifa-dark-float */
}
.et-accordion-trigger:hover {
  background: var(--et-surface-hover-background-solid);
}
```

- Trifft genau, was fifagg von Hand baut; deckend, also für Sticky-Zellen ohne Extra-Mix.
- Aufwand: mittel, plus Sonderfälle: oberste Ebene hat keine nächste; Ebenen-Suche ist exakt
  (Lücke in der Leiter = kein Zustand); in hellen Themes ist die nächste Ebene nicht verlässlich
  „sichtbar anders“ (Storybook: 255 → 240 ist ein Sprung, fifagg dunkel 18 → 25 ein sehr kleiner).
- Bruch: wie A, dazu ändert sich das Aussehen aller Defaults deutlich (deckend statt getönt).
- Grenze: verschmilzt die zwei Achsen wieder. Eine gehoverte Zeile sieht aus wie eine Karte der
  nächsten Ebene; ein Dialog der Ebene +1 über einer gehoverten Zeile hat dieselbe Farbe. Auf
  Untergrund ohne Surface-Scope falsch.

### Modell C: Zustände je Fläche im Theme deklariert (deckend, mit abgeleitetem Default)

Jedes Surface-Theme nennt seine Zustandsfarben selbst; fehlt die Angabe, leitet der Generator sie
wie in A ab, aber deckend über den Hintergrund gemischt.

```ts
{ name: 'fifa-dark-raised', elevation: 1, background: '25 34 45',
  stateColor: { hover: '31 41 55', pressed: '40 49 64' } }
```

```css
.et-surface--fifa-dark-raised {
  --et-surface-hover-background-solid: rgb(31 41 55);
}
```

- Volle Kontrolle je Fläche; pixelgenau für Designs, die Zustandsfarben vorgeben.
- Aufwand: wie B für das SDK; für Apps höher (fifagg 6, fut 4 Themes pflegen je 2 bis 3 Werte).
- Bruch: wie A; ohne Angabe im Theme kein sichtbarer Unterschied zu A auf Surface-Scopes.
- Grenze: deckend, also auf von Hand gefärbtem Untergrund falsch; die Farbe ist wieder absolut,
  nur an der richtigen Stelle gepflegt. Ein falsch gepflegtes Theme kann B-65 wiederholen.

### Vorgabe vom 26.11. (Tom): fifagg ändert sein Aussehen nicht

Ziel ist ein funktionierendes System. fifagg darf sich optisch nicht ändern, ausgenommen sichtbare
Fehler (B-65 ist einer). Folgen:

- **Keine Vereinheitlichung der Stärken in dieser Revision.** Jede Komponente behält ihren
  heutigen Wert (7, 8, 10, 12 … %) als eigenen Default. Das Modell legt die Form fest (welche
  Quelle, welche Schicht, wo stellbar), nicht neue Zahlen. Eine gemeinsame Rampe wäre ein
  späterer, eigener Schritt mit Zustimmung je App.
- **A allein reicht nicht.** fifagg will im Accordion „Hover = Farbe der nächsten Ebene“
  (gg-dark-2 / 3 / 4). Ein durchscheinender Mix trifft das nicht exakt: von 18 23 30 nach
  25 34 45 bräuchte es je Kanal 5 %, 8 % und 10 % der Tönungsfarbe. Es braucht also einen
  ebenen-relativen, deckenden Baustein aus B oder C.
- **Beweis je Schritt zusätzlich:** Bildvergleich der fifagg-Oberfläche vor und nach dem
  SDK-Update, Differenz null außer an den als Fehler benannten Stellen.

### Empfehlung

**A als Regel für die Defaults, dazu der Baustein aus B als Angebot für Apps.**

- Defaults: durchscheinende Schicht wie in A, mit der heutigen Stärke je Komponente. Sichtbar
  ändert sich nichts.
- Der Generator schreibt je Scope (auch `:root`) zusätzlich den Hintergrund der nächsten Ebene
  (Arbeitsname `--et-surface-raised-background-solid`). Eine App, die „Hover = nächste Ebene“
  will, setzt das Komponenten-Token **auf dem Element der Komponente** auf dieses Token:
  `.et-accordion-trigger { --et-accordion-header-hover-background: var(--et-surface-raised-background-solid); }`.
  Eine Deklaration, kein Theme-Name, kein Schalter; der Trigger liest den Wert seiner eigenen
  Umgebung. Auf `:root` gesetzt würde dieselbe Zeile den Wurzelwert in alle Flächen vererben ✔.
- **Die Bildgleichheit für fifagg gilt nur bedingt** ✔. Heute: Inset (Ebene −1) erbt gg-dark-2,
  also zwei Ebenen höher; eine allgemeine „+1“-Regel ergäbe dort die Farbe der Ebene 0. Float
  (Ebene 3) hat keinen Nachfolger und erbt heute gg-dark-4, die eigene Farbe: das ist der Fehler
  B-65. fifagg behält die drei Zeilen deshalb, bis ein Bildvergleich den Ersatz belegt. Was an
  diesen beiden Rändern gelten soll, ist Entscheidung 2.
- Kein Generator-Abbruch bei Farbgleichheit: der Generator kennt den tatsächlich gemalten
  Untergrund nicht (von Hand gefärbte Karten, Sticky-Zellen). Die Messlatte aus Schritt 0 prüft
  das im Browser.
- C (Zustandsfarben je Fläche im Theme) bleibt als Ausbau möglich, falls ein Design Farben
  verlangt, die keiner Ebene entsprechen.

Technische Festlegungen (meine, keine Rückfrage):

- Tönungsquelle bleibt `--et-surface-interaction` (Default-Stufe). Kein neues Pflichtfeld im Theme.
- Statische Tönungen (Skeleton, Track, Zebra, Rahmen) sind keine Zustände und bleiben unberührt.
- cdk bekommt nichts (Wartungsmodus, liest kein Surface-Token).
- Die Schicht wird am Verbraucher gemischt (siehe Modell A); App-Overrides stehen auf dem Element
  der Komponente, nicht auf `:root`.
- Aufräumen (Schritt 6) läuft als eigene Zeilen nach der Revision. Nichts in Schritt 0 bis 4 hängt
  davon ab; nur „`SurfaceInteractiveDirective` vom Button“ wartet auf Schritt 2.

## 4. Migrationsweg

Jeder Schritt ist einzeln auslieferbar. „Beweis“ ist ein Test, der vor dem Schritt fehlschlägt.

| #   | Schritt                                                                                                                                                                                                                                                                                                          | Migration für `et update`                                                                                                                         | Beweis (vorher rot, nachher grün)                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Messlatte.** Playwright-Suite in `apps/storybook-e2e`: jede interaktive Komponente auf jeder registrierten Ebene; prüft, dass sich der berechnete Hover- und Gedrückt-Hintergrund vom Ruhezustand unterscheidet. Dazu der B-65-Fall als Story: Accordion in einem Overlay, App-Override wie in fifagg.         | keine (nur Tests)                                                                                                                                 | Der B-65-Fall ist rot und bleibt bis Schritt 3 als erwartet-rot markiert sichtbar (deine Vorgabe: Lücke bleibt sichtbar).                                       |
| 1   | **Ebenen-Baustein im Generator.** `theme-css.ts` schreibt den Hintergrund der nächsten Ebene auf `:root` und jeden Scope; `colors-skeleton.ts` und `generate-studio-themes.mjs` ziehen nach.                                                                                                                     | `surface-theme-regenerate` als wiederverwendbare manuelle Migration (Befehl steht im Kopf jeder generierten Datei).                               | Spec auf `surfaceThemeCss` (Token fehlt vorher). e2e: Token löst auf verschachtelten Flächen je Scope auf.                                                      |
| 2   | **Komponenten folgen der Formregel** (eine Quelle, Stärke als Default am Verbraucher), vier Scheiben: Listen (Menu, Select, Cascader, Command-Palette, Tree), Tabelle und Zeilen (Table, Standings, Accordion), Formulare, Rest. Braucht kein neu erzeugtes Theme.                                               | keine (kein API-Bruch); Werte bleiben je Komponente gleich.                                                                                       | Neue Regel in `yarn lint:css-properties`: kein handgemischtes `--et-surface-interaction-solid` in einem Zustands-Selektor. Rot bei 51 Dateien, grün je Scheibe. |
| 3   | **Farbige Zustands-Tokens** laut Entscheidung 3 (entfernen oder auf Stärke umstellen): Accordion, Select, Segmented, Table, Button outline/transparent, Pagination, Carousel, Scrollbar.                                                                                                                         | assistiert mit Scan: findet jedes gesetzte Token in CSS, SCSS, HTML und TS der App, nennt Datei und Zeile und den Ersatz.                         | Generator-Spec mit Fixture aus der echten fifagg-Datei `et-accordion.scss`. Der B-65-Fall aus Schritt 0 wird grün.                                              |
| 4   | **Utilities für Apps**: `hover:bg-et-surface-state-hover` usw. aus dem `@theme`-Block; Doku-Warnung zu `hover:bg-et-surface-interaction-hover` wird zur Empfehlung des neuen Namens.                                                                                                                             | keine (additiv). Ersatz der App-eigenen Klassen (`hover:bg-gg-dark-3`) ist App-Arbeit, kein `et update`.                                          | Spec auf den `@theme`-Block; e2e-Story mit der Utility auf drei Ebenen.                                                                                         |
| 5   | **Akzent-Zustände** (Ausgewählt, Gewählt): eine Rampe statt 0.08 / 0.12 / 0.16 und 12 bis 35 % (**nicht Teil der Revision**, Entscheidung vom 26.11.; eigene spätere Zeilen); handgesetztes `--et-color-primary-active` in Checkbox, Radio, Select-All streichen; Roh-Kanäle in 11 Komponenten-Dateien ersetzen. | keine, falls kein öffentliches Token fällt; sonst wie Schritt 3.                                                                                  | Lint-Regel gegen Roh-Kanäle (rot bei 11 Dateien). Messlatte aus Schritt 0 um „ausgewählt“ erweitert.                                                            |
| 6   | **Entfernen**: veraltete `inject{Error,Warning,Success}Theme`, `colorTheme`, `semanticColorThemes`, `legacy-theming.ts`; Testhelfer auf den Tailwind-4-Provider; `SurfaceInteractiveDirective` vom Button; cli-Kopie des Sheets erzeugen statt pflegen.                                                          | auto: `inject*Theme` → `injectSemanticColorTheme(type)` (trifft fut an 8 Stellen); `color-theme-variants` und `legacy-color-themes` auf required. | Generator-Specs mit Fixtures aus fut. `removed-exports`-Prüfung in den Generatoren. 71 Specs laufen ohne Legacy-Provider.                                       |
| 7   | **Doku und Regeln**: `apps/docs/core/theming.md`, Skill `theming`, `libs/agent-rules/content` (dann `yarn agents:sync`). Läuft in jedem Schritt mit; hier der Abschluss mit der Rollentrennung von `interactionColor`.                                                                                           | keine                                                                                                                                             | Doku-Beispiele (`apps/docs-examples`) rendern auf drei Ebenen in der Messlatte.                                                                                 |

Abhängige Zeilen: **B756** (Tabs-Variante liest alle `et-tab`-Tokens) nach Schritt 3, weil dort
die Namensregel für Zustands-Tokens fällt. **B759** (destructive im Design-Kit-Menü) ist
unabhängig (Farb-Theme nach Typ) und wartet nicht.

Reihenfolge der Konsumenten: fifagg zuerst (nah am aktuellen Stand, hat den Fall), fut danach
(34 Releases zurück, muss ohnehin durch die älteren Migrationen).

## 5. Risiken

- Zwei Schreibwege für Tokens (`theme-css.ts` und `colors-skeleton.ts`): Schritt 1 muss beide
  ändern, sonst zeigt Studio ein anderes Modell als die Apps.
- Apps, die ihre Themes nicht neu erzeugen: Schritt 2 braucht kein neues Theme; nur der
  Ebenen-Baustein fehlt ihnen, und den nutzt erst, wer ihn setzt.
- fut liest `--et-surface-interaction-*` als Textfarbe (5 Lesestellen, 25 Utilities): diese
  Namen bleiben unverändert.
- Die Zählungen der Subagenten können Lücken haben (nicht einzeln geprüft: Sidebar, Navigation,
  Stepper, Toggle, List). Schritt 0 findet sie, weil die Messlatte jede Story mit Zustand prüft.

## 6. Entscheidungen

Offen, in dieser Reihenfolge (eine nach der anderen):

1. **Modell**: A, B, C oder A mit dem Ebenen-Baustein aus B. Empfehlung: A mit Baustein.
2. **„Hover = nächste Ebene“**: für welche Komponenten gilt die Regel, und was gilt an den
   Rändern (oberste Ebene ohne Nachfolger, Inset auf Ebene −1).
3. **Farbige Zustands-Tokens der Komponenten**: entfernen, auf Stärke umstellen oder behalten.
   Kern ist die Zusage: bestehende Overrides behalten ihr Aussehen.
4. **Utilities für Apps** (Schritt 4) ja oder nein.

Entschieden:

- (26.11., Tom) Ziel ist ein funktionierendes System; fifagg ändert sein Aussehen nicht,
  ausgenommen sichtbare Fehler.
- (vorab, Tom) Kein neues Token als schnelle Lösung; die Lücke bleibt bis zur Revision sichtbar;
  das SDK liefert keine Theme-Namen; kein ADR.
- (26.11., technisch, Fable) Aufräumen (Schritt 6) als eigene Zeilen nach der Revision; Schicht am
  Verbraucher gemischt; App-Override auf dem Element der Komponente; kein Generator-Abbruch bei
  Farbgleichheit.
- (26.11., Tom) Umfang: „nur neutrale ‚surface themes‘ zustände“. Die Revision deckt Hover und
  Gedrückt der Surface-Themes ab. Akzent-Zustände (Ausgewählt, Gewählt), die Akzent-Rampe, das
  handgesetzte `--et-color-primary-active` und der Fokus-Ring sind nicht Teil der Revision
  (Schritt 5 entfällt hier und wird spätere eigene Zeilen). Meine Auslegung: das Ersetzen der
  Surface-Roh-Kanäle in Komponenten-CSS per Lint bleibt drin, weil es Surface-Tokens betrifft und
  optisch nichts ändert; die Messlatte aus Schritt 0 prüft nur Hover und Gedrückt.
