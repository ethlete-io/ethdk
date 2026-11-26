# Theming-Revision (B757)

Stand: 26.11.2026. Status: **Entschieden (Tom, 26.11.), bereit für die Queue.** Kein
Builder-Start vorher.

**Maßstab der Revision (Tom, 26.11.): Das System wird kleiner und erklärbar, nicht größer.** Ein
Flicken für B-65 mit weiteren Tokens ist ausdrücklich nicht das Ziel. Öffentliche Namen dürfen
brechen, wenn jede Änderung eine Auto-Migration in `et update` mitbringt und das Bild in fifagg
gleich bleibt. Abschnitt 3 ist das Zielbild, 4 die Streichliste, 5 der Weg, 6 die Demo. Abschnitte
0 bis 2 sind der Bestand, auf dem das beruht.

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

| Familie                                                                 | Definition                                     | Lesestellen                                                                                      | Überschneidung                              | Urteil und Grund                                                                                                            |
| ----------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `--et-surface-{background,color,color-muted,color-subtle,border}-solid` | Alias-Block in `libs/core/design/theme-css.ts` | 830 Vorkommen, 271 Dateien; fut etwa 40                                                          | Roh-Kanäle                                  | **B**. Tragende Schicht.                                                                                                    |
| Roh-Kanäle `--et-surface-background` usw. in Komponenten-CSS            | Theme-Klassen                                  | 11 Produktiv-CSS-Dateien in components (Button, Checkbox, Dropzone, Form-Field, Radio, Switch …) | Regelverstoß gegen die Skill-Regel          | **Z**: auf `-solid`/`-rgb` umstellen, Lint-Regel (Schritt 5).                                                               |
| `--et-surface-interaction-solid` / `-rgb`                               | Alias-Block                                    | 148 / 27 Vorkommen; components 59 Dateien; fut 4                                                 | Tönungsquelle **und** Textfarbe             | **Z**. Als Textfarbe bleiben; Flächen lesen künftig das Modell aus Abschnitt 3.                                             |
| `--et-surface-interaction-{hover,focus,active,disabled}-solid`          | Alias-Block, je Scope definiert ✔              | components 8 Dateien (davon 7 nur `disabled` für Text), cli 3; fut 1 + 25 Utilities              | –                                           | **B** als Text-Leiter.                                                                                                      |
| `--et-surface-on-interaction*`, `--et-surface-interaction-ink*`         | theme-css.ts, nur über Farbe `surface`         | 0 direkte Leser                                                                                  | –                                           | **B**. Nur Zuträger der Farbe `surface`; aus der öffentlichen Token-Tabelle nehmen.                                         |
| `--et-theme-color-{primary,on-primary,ink}-*`                           | Alias-Block Farbe                              | 419 / 74 / 216 Vorkommen                                                                         | `--et-color-primary*`                       | **B**.                                                                                                                      |
| Roh `--et-color-primary*` in Komponenten-CSS                            | Theme-Klassen                                  | components etwa 70 Vorkommen; fifagg 64, fut 92                                                  | zweiter Name derselben Farbe                | **Z** im SDK (Lint). Für Apps bleibt der Name bestehen.                                                                     |
| Komponenten-Zustands-Tokens `--et-<komponente>-{hover,active,…}-*`      | je Komponenten-CSS                             | etwa 55 Namen; fifagg setzt 22 mit Zustands- oder Hintergrundbezug, fut 29                       | jedes ein eigenes Mini-Modell               | **Z**: Farb-Tokens für Flächenzustände weg oder auf Stärke umstellen (entschieden: behalten). Text- und Maß-Tokens bleiben. |
| Tailwind-Utilities `*-et-surface-*`, `*-et-theme-*`                     | `@theme`-Block im generierten CSS              | timetrack 68 Dateien, studio 43; fut mit Präfix `fut`                                            | `bg-et-surface-interaction` ×25 ist Vollton | **B**, um Zustands-Utilities ergänzen (Schritt 4).                                                                          |
| cdk-Tokens                                                              | je cdk-SCSS                                    | cdk liest kein Surface-Token; nur Carousel liest `--et-color-primary`                            | –                                           | **B**, unberührt (Wartungsmodus).                                                                                           |

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

## 3. Zielbild: so funktioniert das System danach

Drei Begriffe, je ein Satz, je ein Namensraum. Mehr muss ein App-Entwickler nicht wissen.

| Begriff     | Was es ist                                                                                                 | Wie man es setzt                                       | Was man liest                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Fläche**  | Eine Ebene mit fünf Farben: Hintergrund, Text, Text gedämpft, Text schwach, Rahmen.                        | `etSurface` (eine Ebene höher) oder `etSurface="name"` | `--et-surface-*`, **ein** Name je Wert, ein fertiger Farbwert                |
| **Ton**     | Die Farbe, in der eine Komponente auftritt: Füllung, Text darauf, Text.                                    | `etTone="name"`                                        | `--et-tone-*`, **ein** Name je Wert, ein fertiger Farbwert                   |
| **Zustand** | Hover und Gedrückt sind eine durchscheinende Tönung über dem, was darunter liegt. Stellbar ist die Stärke. | nichts; Komponenten bringen ihre Stärke mit            | Apps: eine Utility für die Tönung, eine für „Hintergrund der nächsten Ebene“ |

**Wörter (Tom, 26.11.): Das zweite Konzept heißt `tone`, nicht mehr `color`.** Ein Ton ist die
Farbe, in der eine Komponente auftritt (`brand`, `danger`, eine Teamfarbe; Vorbild: Polaris,
Sanity UI). `accent` ist verworfen (Material: zweite Farbe neben `primary`), `color` ebenfalls
(„super unbeschreibend“, und `--et-surface-color` meint die Textfarbe). Wo dieser Plan weiter
unten noch „Ton“ oder `--et-color-*` als Zielname schreibt, gilt diese Tabelle:

| Heute                                     | Danach                                   |
| ----------------------------------------- | ---------------------------------------- |
| Color-Theme                               | Tone                                     |
| `--et-color-primary`                      | `--et-tone-fill`                         |
| `--et-color-on-primary`                   | `--et-tone-on-fill`                      |
| `--et-color-primary-ink`                  | `--et-tone-text`                         |
| `--et-surface-color`, `-muted`, `-subtle` | `--et-surface-text`, `-muted`, `-subtle` |
| Inputs `color`, `pressedColor`            | `tone`, `pressedTone`                    |

Tailwind (Hinweis Tom, 26.11.): Der `@theme`-Block braucht weiter den Namensraum `--color-*`,
aus dem Tailwind die Utilities erzeugt. Das ist Tailwind-intern und bleibt. Nur der Teil dahinter
folgt der Worttabelle, und damit ändern sich die Klassennamen: `bg-et-theme-primary` →
`bg-et-tone-fill`, `text-et-surface-color` → `text-et-surface-text`. Das trifft ✔ fut an etwa 240
Stellen, die SDK-Apps an etwa 770, fifagg an 1; Auto-Migration im selben Durchgang (S1, S2, S9).

Kein neuer Token-Name hat je ein Kanal-Tripel bedeutet; damit entfällt der Spike „welcher Name
überlebt“ aus Schritt 1.

**Direktiven (Tom, 26.11.: „ja das passt“):** Eine App kennt danach zwei.

| Heute                                                                   | Danach                                                                                                                             | Vorkommen ✔ (ohne Specs)                          |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `etAutoSurface` (eine Ebene höher), `etProvideSurface="name"` (benannt) | `etSurface`, `etSurface="name"`                                                                                                    | Auto: fifagg 0, fut 15; Provide: fifagg 5, fut 11 |
| `etProvideColor="name"`                                                 | `etTone="name"`                                                                                                                    | fifagg 94, fut 431                                |
| `forceColor`, `syncWithProvider` (Inputs an `etProvideColor`)           | vom Builder zu prüfen: `syncWithProvider` nutzt keine App ✔ → intern; `forceColor` (fifagg 1, fut 5) bleibt als Input von `etTone` | –                                                 |
| `etSurfaceInteractive`                                                  | entfällt (S4)                                                                                                                      | fifagg 0, fut 0                                   |
| `etColorInteractive`, `…Container`, `…Exclude`, `…HasFocus`             | SDK-intern, aus der App-Doku; nur umbenannt (`etToneInteractive…`), Verhalten unberührt (Umfang)                                   | Apps 0 bis 1                                      |

Vom Builder vor dem Umbau zu belegen: `etAutoSurface` bindet `ProvideSurfaceDirective` schon als
Host-Direktive ✔ und hat einen Input `surfaceProvider`; ob beide ohne Verhaltensänderung in einer
Direktive aufgehen, zeigt die bestehende Spec-Suite.

**Interne `…Interactive`-Direktiven (Tom, 26.11.: ja): das
Muster entfällt ganz (S10).** Heute hängt eine Direktive eine Klasse an, und ein globales Sheet
tauscht je Zustand den **Wert** von `--et-theme-color-primary-*` auf dem Element ✔. Die Komponente
schreibt `background: var(…-solid)` einmal und bekommt Hover und Gedrückt geschenkt. Der Preis:
der Zustand steckt in einer vererbenden Variable und läuft in alle Nachfahren. Zwei ausgelieferte
Fehler sind in den Kommentaren der Direktiven dokumentiert ✔, und drei Hilfs-Direktiven
(`Container`, `Exclude`, `HasFocus`) existieren nur, um dieses Auslaufen zu flicken ✔.

Danach: Der Zustand steht dort, wo er gemalt wird. Das Theme liefert jeden Zustand unter eigenem
Namen (`--et-tone-fill`, `--et-tone-fill-hover`, `--et-tone-fill-active` …), der Generator löst
die Rückfälle (kein Hover-Wert → Grundwert) einmal auf, statt sie in bis zu sechsfach
verschachtelten `var()`-Ketten im Sheet zu tragen ✔. Die Komponente schreibt
`&:hover { background: var(--et-tone-fill-hover); }`. Das sind etwa drei Zeilen je Komponente
(22 Nutzer von `etColorInteractive`, 2 Container, 4 Exclude, 1 HasFocus), dafür entfallen vier
Direktiven, 147 Zeilen Sheet und die Fehlerklasse. Label-Hover (Container) und Fokus im Rahmen
(HasFocus) werden gewöhnliche Selektoren im CSS der Komponente. Werte bleiben gleich; das ist
kein Eingriff in die Rampe (Umfang). Vom Builder zu belegen: jedes Theme liefert alle Zustände,
auch zur Laufzeit gesetzte Farben („Offering colors to a user“).

Was daraus folgt:

- **Jeder Name sagt, wofür die Farbe gebraucht wird** (Tom, 26.11.: „wirre wörter wie ink“).
  Ein Ton hat heute `color`, `onColor`, `inkColor` in bis zu drei Paletten
  (`primary`, `secondary`, `tertiary`). `secondary` und `tertiary` nutzt keine App ✔ (fifagg 0,
  fut 0); ohne sie sagt auch `primary` nichts mehr. Danach hat ein Ton drei Werte mit
  sprechenden Namen (Arbeitsnamen):

  | Heute                         | Danach   | Bedeutung in einem Satz                                                      |
  | ----------------------------- | -------- | ---------------------------------------------------------------------------- |
  | `color`, `--et-color-primary` | `fill`   | Der Ton als Fläche (gefüllter Button).                                       |
  | `onColor`, `on-primary`       | `onFill` | Text und Icons **auf** dieser Fläche.                                        |
  | `inkColor`, `-ink`            | `text`   | Der Ton als Text oder Rahmen auf der normalen Fläche (Outline-Button, Link). |

  `text` gibt es, weil eine Füllfarbe als Schrift oft zu wenig Kontrast hat (helles Gelb auf
  Weiß); fehlt die Angabe, gilt `fill`. Dieser eine Satz steht in der Doku neben dem Namen.
  Dieselbe Regel gilt für jedes andere Wort im System: ein Name, der sich nicht in einem Satz
  erklären lässt, wird umbenannt oder gestrichen (Prüfliste in Schritt 1: `muted` / `subtle`,
  `interaction`, `on-interaction`, `interaction-ink`).

- **Ein Name pro Wert.** Heute hat jeder Wert drei bis fünf Namen (`--et-surface-background`,
  `-rgb`, `-solid`; bei Tonen `--et-color-primary`, `--et-theme-color-primary-rgb`, `-solid`,
  unsuffigiert, `-opacity`). Danach genau einer, und er ist ein Farbwert, kein Kanal-Tripel.
  Deckkraft entsteht mit `color-mix()` oder relativer Farbsyntax am Verbraucher.
- **`interactionColor` wird in seine Rollen geteilt.** Das Theme nennt getrennt die Textfarbe
  neutraler Bedienelemente (Leiter mit Zuständen) und die Tönungsquelle (eine Farbe, Default: die
  Textfarbe der Fläche). Die reservierte Farbe `surface` leitet sich daraus ab und ist kein dritter
  Zweck desselben Feldes mehr.
- **Zwei Direktiven für Apps** (`etSurface`, `etTone`), keine Direktive schaltet mehr unsichtbar
  Farben um (Tabellen oben).
- **Zustände folgen einer Formregel, per Lint erzwungen**: eine Tönungsquelle, Stärke als Default
  an der Komponente, am Verbraucher gemischt. Die heutigen Stärken je Komponente bleiben (sonst
  ändert sich das Bild). Zustands-Tokens der Komponenten bekommen **ein** Namensmuster statt
  heute vier (`-hover-background`, `-background-hover`, `-hover-fill`, `-hover-rgb`).
- **B-65 ist ein Sonderfall der Regel, kein Zusatz.** Der Generator kennt die Ebenenleiter und
  schreibt je Fläche den Hintergrund der nächsten Ebene. Eine App, die „Hover = nächste Ebene“
  will, verweist darauf, auf dem Element der Komponente. Auf der obersten Ebene gibt es keinen
  Nachfolger; dort greift die Tönung.

Messzahlen (vorher → Ziel; „vorher“ am 26.11. gezählt ✔, Ziel ist Vorgabe für den Builder):

| Größe                                          | Vorher                                                                       | Ziel                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Namen je Flächenwert                           | 3 (roh, `-rgb`, `-solid`)                                                    | 1                                     |
| Namen je Tonwert                               | bis 5                                                                        | 1                                     |
| Paletten je Ton                                | 3 (`primary`, `secondary`, `tertiary`), zwei davon ungenutzt                 | 1                                     |
| Rollen von `interactionColor`                  | 3 in einem Feld                                                              | 1 je Feld                             |
| Direktiven, die eine App kennen muss           | 5 (+3 Helfer-Direktiven)                                                     | 2                                     |
| Direktiven, die Farben per Variable umschalten | 5, dazu 147 + 40 Zeilen Sheet                                                | 0                                     |
| Namensmuster für Zustands-Tokens               | 4                                                                            | 1                                     |
| Alt-System                                     | `legacy-theming.ts` 268 Zeilen, 3 veraltete Helfer, 2 veraltete Theme-Felder | 0                                     |
| Doku `apps/docs/core/theming.md`               | 507 Zeilen, 14 Abschnitte                                                    | Modell auf einer Seite, Rest Referenz |
| fifagg-Bildvergleich                           | –                                                                            | Differenz null außer B-65             |

### 3.1 Namenstabelle (Vertrag für fifagg und fut, Stand 26.11.)

Die Quelle ist `libs/core/generators/migrate-theme-token-names/token-names.ts`; der Generator
`@ethlete/core:migrate-theme-token-names` liest nur diese Tabelle. `<z>` ist `hover`, `focus`, `active` oder `disabled`.

| Alt                                                                                 | Neu                                                                    | Art alt → neu       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- |
| `--et-surface-background`, `-rgb`, `-solid`                                         | `--et-surface-background`                                              | Tripel → Farbe      |
| `--et-surface-color`, `-rgb`, `-solid`                                              | `--et-surface-text`                                                    | Tripel → Farbe      |
| `--et-surface-color-muted` / `-subtle`, je `-rgb`, `-solid`                         | `--et-surface-text-muted` / `-subtle`                                  | Tripel → Farbe      |
| `--et-surface-border`, `-rgb`, `-solid`                                             | `--et-surface-border`                                                  | Tripel → Farbe      |
| `--et-surface-{interaction,on-interaction,interaction-ink}[-<z>]`, `-rgb`, `-solid` | gleicher Name (Schritt 2 benennt um)                                   | Tripel → Farbe      |
| `--et-color-primary`, `--et-color-primary-<z>`                                      | `--et-tone-fill-rest`, `--et-tone-fill-<z>`                            | Tripel → Farbe      |
| `--et-color-on-primary[-<z>]`                                                       | `--et-tone-on-fill-rest`, `-<z>`                                       | Tripel → Farbe      |
| `--et-color-primary-ink[-<z>]`                                                      | `--et-tone-text-rest`, `-<z>`                                          | Tripel → Farbe      |
| `--et-theme-color-primary`, `-rgb`, `-solid`                                        | `--et-tone-fill`                                                       | → Farbe             |
| `--et-theme-color-on-primary`, `-rgb`, `-solid`                                     | `--et-tone-on-fill`                                                    | → Farbe             |
| `--et-theme-color-ink`, `-rgb`, `-solid`                                            | `--et-tone-text`                                                       | → Farbe             |
| `--et-theme-color-primary-opacity`                                                  | `--_et-tone-fill-opacity` (privat, gelesen mit Fallback `1`)           | Zahl                |
| `--et-theme-color-on-primary-opacity`, `--et-theme-color-ink-opacity`               | entfällt (Wert `1` wird gelöscht, jeder andere Wert stoppt)            | -                   |
| `--et-color-{secondary,tertiary,on-secondary,on-tertiary}[-ink][-<z>]`              | entfällt (stoppt)                                                      | -                   |
| `--et-shadow-color-rgb`, `--et-scrim-color-rgb`, `--et-on-scrim-color-rgb`          | `--et-shadow-color`, `--et-scrim-color`, `--et-on-scrim-color`         | Tripel → Farbe      |
| `--et-button-filled-hover-rgb`                                                      | `--et-button-filled-hover`                                             | Tripel → Farbe      |
| Tailwind dynamisch `<p>-theme[-<z>]`, `<p>-on-theme[-<z>]`, `<p>-theme-ink[-<z>]`   | `<p>-tone-fill[-<z>]`, `<p>-tone-on-fill[-<z>]`, `<p>-tone-text[-<z>]` | Utility, `--color-` |
| Tailwind statisch `<p>-<ton>[-<z>]`, `<p>-on-<ton>[-<z>]`, `<p>-<ton>-ink[-<z>]`    | `<p>-tone-<ton>-fill[-<z>]`, `-on-fill`, `-text`                       | Utility, `--color-` |
| Tailwind `<p>-surface[-<fläche>]-bg`, `<p>-surface[-<fläche>]`, `-muted`, `-subtle` | `…-background`, `…-text`, `…-text-muted`, `…-text-subtle`              | Utility, `--color-` |

Regeln: `rgb(<tripel>)` wird die Farbe, `rgb(<tripel> / A)` wird `color-mix(in srgb, <farbe> A%, transparent)`,
ein Tripel-Literal wird `rgb(…)`. Bleiben: `--et-surface-type`, `--et-surface-elevation`, `--et-color-theme-type`,
`--et-surface-color-theme-variants`, `--et-color-picker-*`, `--et-color-input-*`. Fifagg und fut setzen
`--et-theme-color-primary-opacity` nirgends von Hand (0 Treffer außer der synchronisierten Theming-Skill-Doku).
Der Generator stoppt mit Datei und Zeile bei: `-rgb` ohne `-solid` im selben Block neu gesetzt; Tripel außerhalb
`rgb()` gelesen; altes Tripel aus einem unbekannten Wert gesetzt; zwei alte Namen, die mit verschiedenen Werten in
einen neuen fallen; `rgb()` über eine gemischte Kette; entfallene Namen; jeder Rest der alten Familien
(z. B. `--et-surface-bg-solid` in fut).

## 4. Streichliste

Jeder Punkt: was geht, wen es trifft (Vorkommen ✔ vom 26.11., generierte Dateien mitgezählt), wie
`et update` es umschreibt.

| #   | Was geht                                                                                                  | Trifft (Vorkommen)                                                                                  | Migration                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Flächen-Tokens `-rgb` und `-solid`; Roh-Tripel wird Farbwert                                              | SDK-Libs 937 / 31 / 124 (`-solid` / `-rgb` / roh in `rgb()`); fifagg 13 / 20 / 46; fut 58 / 20 / 49 | auto: Namen und `rgb(var(…) / a)`-Formen umschreiben; Themes neu erzeugen. Danach Prüfung: kein alter Name mehr, sonst bricht `et update` ab. |
| S2  | Ton-Tokens: `--et-theme-color-*` in allen Formen und das Roh-Tripel; es bleibt `--et-tone-*`              | SDK-Libs 586 + 97 + 384; fifagg 22 + 9 + 474; fut 22 + 27 + 572                                     | wie S1                                                                                                                                        |
| S3  | `interactionColor` als Sammelfeld; `--et-surface-interaction*`, `-on-interaction*`, `-interaction-ink*`   | Theme-Dateien (fifagg 6, fut 4 Themes); fut 5 Lesestellen + 25 Utilities                            | auto: Theme-Feld aufteilen, Token- und Utility-Namen umschreiben                                                                              |
| S4  | `SurfaceInteractiveDirective`, ihr Sheet, die cli-Kopie des Sheets                                        | SDK-Libs 16, SDK-Apps 15; fifagg 0, fut 0                                                           | im Repo von Hand (Tabs lesen die Zustandsfarbe direkt); für Apps auto: Attribut entfernen, Hinweis je Fundstelle                              |
| S5  | Vier Namensmuster der Zustands-Tokens                                                                     | etwa 55 Namen; fifagg setzt 22, fut 29                                                              | auto: umbenennen. Die Tokens nehmen weiter eine Farbe an; die Doku empfiehlt Stärke oder das Ebenen-Token statt fester Farbe.                 |
| S6  | `legacy-theming.ts`, `inject{Error,Warning,Success}Theme`, `colorTheme`, `semanticColorThemes`            | fut 8 Stellen; SDK-Testhelfer (71 Specs), `apps/csp`                                                | auto: `inject*Theme` → `injectSemanticColorTheme(type)`; bestehende Migrationen `color-theme-variants`, `legacy-color-themes` auf required    |
| S7  | Zweiter Schreibweg für Tokens (`colors-skeleton.ts`, `generate-studio-themes.mjs` schreiben Namen selbst) | nur Repo                                                                                            | keine; beide rufen `themeCss` auf                                                                                                             |
| S8  | Fünf Helfer „welche Fläche“ und `SurfaceContextTracker` als öffentliche API                               | components 14, cdk 2; Apps 0                                                                        | `@internal` markieren, aus der Doku nehmen; kein Bruch im Verhalten                                                                           |

Dazu **S9**: Wortliste. `ink` → `text`, `color`/`primary` → `fill`, `onColor`/`on-primary` →
`onFill` (Vorkommen ✔: `ink` SDK-Libs 564, fifagg 379, fut 366; `on-primary`/`onColor` 436 / 310 /
271), und die Paletten `secondary` und `tertiary` entfallen (SDK-Libs 9 / 6, Apps 0). Migration
auto, zusammen mit S2 in einem Durchgang, damit jede Datei nur einmal angefasst wird.

Dazu **S10** (Tom, 26.11.): `etColorInteractive`, `…Container`, `…Exclude`, `…HasFocus` und ihr
Sheet entfallen. Trifft nur das SDK (22 / 2 / 4 / 1 Nutzer in components; Apps 0 bis 1). Die
Komponenten schreiben ihre Zustände aus und lesen `--et-tone-fill-hover` usw.; der Generator löst
die Rückfälle auf. Migration für Apps: auto, Attribut entfernen und Fundstelle melden.

Die Urteile in den Tabellen der Abschnitte 1 und 2 stammen aus der Triage vom 25.11.; wo sie dem
Zielbild widersprechen, gilt das Zielbild.

Nicht gestrichen, mit Grund:

- **Die 24 Stärken** (7, 8, 10, 12 … %). Angleichen ändert das Bild. Eigene spätere Zeile.
- **Ton-Zustände und Fokus-Ring** (Umfangsentscheidung vom 26.11.). S2 benennt Ton-Tokens
  nur um; Werte und Rampen bleiben.
- **`provideColorPalette`** (kategoriale Farben für Charts). Eigenes Thema.
- **cdk.** Wartungsmodus, liest kein Surface-Token.

## 5. Weg

Jeder Schritt ist einzeln auslieferbar. „Beweis“ ist ein Test, der vor dem Schritt fehlschlägt.
Nach jedem Schritt: `et update` in fifagg, Bildvergleich gegen die Aufnahme aus Schritt 0.

| #   | Schritt                                                                                                                                                                                                                                                | Beweis                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | **Messlatte und Demo.** Die Demo-Seite aus Abschnitt 6 auf dem heutigen System; Playwright prüft auf ihr: Hover und Gedrückt unterscheiden sich auf jeder Ebene vom Ruhezustand. B-65 als Fall darin. Bildaufnahme der fifagg-Oberfläche als Referenz. | B-65-Fall rot, als erwartet-rot markiert sichtbar bis Schritt 3.                                                                              |
| 1   | **Ein Name pro Wert, sprechende Wörter** (S1, S2, S7, S9). Generator schreibt die neuen Namen; SDK-CSS wird umgeschrieben; Migration für Apps.                                                                                                         | Lint-Regel „kein alter Token-Name“ (rot bei allen Fundstellen, grün danach). Generator-Specs mit Fixtures aus echten fifagg- und fut-Dateien. |
| 2   | **Rollen trennen** (S3, S4).                                                                                                                                                                                                                           | Spec auf `themeCss`; Generator-Spec mit den echten Theme-Dateien beider Apps; Tabs-Story in der Messlatte unverändert.                        |
| 3   | **Zustände** (S5, S10): Formregel in vier Scheiben (Listen, Tabelle und Zeilen, Formulare, Rest), Ebenen-Baustein im Generator, ein Namensmuster.                                                                                                      | Lint-Regel gegen handgemischte Zustände außerhalb der Form (rot bei 51 Dateien). B-65-Fall wird grün.                                         |
| 4   | **Utilities für Apps**: Tönung und „Hintergrund der nächsten Ebene“.                                                                                                                                                                                   | Spec auf den `@theme`-Block; die Demo nutzt beide.                                                                                            |
| 5   | **Alt-System raus** (S6, S8).                                                                                                                                                                                                                          | `removed-exports`-Prüfung; 71 Specs laufen ohne Legacy-Provider; Generator-Specs mit Fixtures aus fut.                                        |
| 6   | **Doku und Regeln**: `theming.md` neu (Modell auf einer Seite, Demo oben, Referenz darunter), Skill `theming`, `libs/agent-rules/content` (dann `yarn agents:sync`).                                                                                   | Doku-Beispiele rendern in der Messlatte auf allen Ebenen.                                                                                     |

Technische Festlegungen (meine, keine Rückfrage):

- Die neuen Namen stehen in der Worttabelle in Abschnitt 3. Eine nicht migrierte Lesestelle muss
  laut scheitern (Lint oder `et update`-Prüfung auf alte Namen), nie still eine ungültige Farbe
  ergeben.
- Zustände werden am Verbraucher gemischt; App-Overrides stehen auf dem Element der Komponente,
  nicht auf `:root` (ein auf `:root` gesetztes `var()` löst dort auf und vererbt den Wurzelwert ✔).
- Kein Generator-Abbruch bei Farbgleichheit; die Messlatte prüft im Browser.
- Schritt 1 und 2 sind reine Umbenennungen und zuerst dran: sie machen das System lesbar, bevor
  jemand an Zuständen baut.
- fifagg behält seine drei Accordion-Zeilen, bis der Bildvergleich den Ersatz belegt. Inset
  (Ebene −1) nutzt fifagg nirgends ✔.

Abhängige Zeilen: **B756** (Tabs-Variante liest alle `et-tab`-Tokens) nach Schritt 3 (Namensmuster).
**B759** ist unabhängig. Reihenfolge der Konsumenten: fifagg zuerst, fut danach (34 Releases
zurück, muss ohnehin durch die älteren Migrationen).

## 6. Demo auf der Doku-Seite (Tom, 26.11.)

Eine Live-Demo in `apps/docs-examples`, oben in `apps/docs/core/theming.md` eingebettet. Sie zeigt
das ganze System in Aktion und ist zugleich die Bühne der Messlatte aus Schritt 0.

- **Ebenen ineinander**: Wurzel, darin eine Fläche, darin eine Karte, dazu ein Overlay auf der
  obersten Ebene. Jede Ebene zeigt ihren Namen und ihre fünf Werte live.
- **Dieselben Komponenten auf jeder Ebene**: Accordion, Menü, Tabellenzeile, Tabs, Buttons. So
  sieht man, dass Hover und Gedrückt überall funktionieren, ohne dass jemand etwas einstellt.
- **Schalter**: hell/dunkel, Ton wechseln, „Hover = nächste Ebene“ ein/aus (der Baustein aus
  Schritt 3, inklusive der obersten Ebene ohne Nachfolger).
- **Der Code daneben**: die drei Direktiven und die Theme-Definition, die das Gezeigte erzeugen.

Die Demo entsteht in Schritt 0 auf dem heutigen System und wird mit jedem Schritt einfacher; ihr
Quelltext ist der Beleg, dass das System kleiner wird. Die Theme-Namen in der Demo gehören der
Demo-App, nicht dem SDK.

## 7. Risiken

- **Größe von Schritt 1.** Über 2000 Fundstellen in den SDK-Libs, je rund 600 in fifagg und fut.
  Rein mechanisch, aber die Migration muss jede Schreibform kennen (`rgb(var(…))`,
  `rgb(var(…) / a)`, Tailwind-Konfiguration, SCSS-Funktionen). Deshalb Fixtures aus den echten
  Apps und die Abbruch-Prüfung auf Reste.
- **fut liegt 34 Releases zurück** und trifft alle Migrationen auf einmal.
- **Die Zählungen können Lücken haben** (nicht einzeln geprüft: Sidebar, Navigation, Stepper,
  Toggle, List). Die Messlatte findet sie.
- **Pixelgleichheit beim Wechsel der Deckkraft-Schreibweise** (`rgb(tripel / a)` →
  `color-mix()`): rechnerisch gleich, wird in Schritt 1 am Bildvergleich belegt, nicht angenommen.

## 7a. Nachträge: was die Umbenennung außerdem trifft

Am 26.11. nach der Bestätigung geprüft („haben wir sonst noch was übersehen?“). Gehört in die
Schritte, in denen es anfällt; keine neue Entscheidung nötig.

- **Das Wort `color` steckt auch in der TS-API und den Generatoren**, nicht nur in Tokens:
  `ColorTheme`, `provideColorThemes`, `colorThemeVariants`, `injectSemanticColorTheme`, Generator
  `tailwind-4-color-theme`, CSS-Klasse `.et-color--<name>` ✔. Alles wird `tone` (Schritt 1, S9),
  mit Auto-Migration. `provideColorPalette` (Chart-Farben) behält seinen Namen.
- **Die reservierte Farbe `surface`** (`etProvideColor="surface"`) wird `etTone="neutral"`
  (Arbeitsname): „Ton surface“ würde die zwei Begriffe wieder vermischen.
- **cdk hat zwei Berührungspunkte**, obwohl sein CSS das Surface-System nicht nutzt (eigene
  Tokens und feste Farben). Erstens liest `carousel.component.scss` an 5 Zeilen das Roh-Tripel
  `--et-color-primary*` mit festem Rückfallwert ✔: fällt der Name weg, greift still der Rückfall
  und das Carousel verliert die Theme-Farbe. Zweitens importieren 13 TS-Dateien
  `ProvideColorDirective` / `COLOR_PROVIDER` / `SURFACE_PROVIDER` aus core ✔ und brechen beim
  Umbenennen im Build. Beides wird mitmigriert (Schritt 1), sonst nichts. query-devtools (6
  Dateien ✔) und libs/cli (48 Dateien ✔: Studio-Design-Sheets, Skeleton, Migrationen) ziehen
  ebenfalls mit.
- **Agent-Regeln und Skills schreiben die alten Namen vor** (`libs/agent-rules/content` 5 Dateien,
  `.agents/skills` 4 ✔, dazu der generierte Block in `AGENTS.md`). Sie müssen **im selben Schritt**
  wie die Umbenennung wechseln, nicht erst in Schritt 6, sonst schreiben Agenten am nächsten Tag
  wieder alte Namen. Dasselbe gilt für die Lint-Regeln in `@ethlete/eslint-plugin`.
- **Schatten- und Scrim-Farben** (`--et-shadow-color-rgb`, `--et-scrim-color-rgb` ✔) fehlen im
  Bestand. Sie folgen der Regel „ein Name, ein Farbwert“ (Schritt 1).
- **Schritt 1 ist eine Umbenennung über das ganze Repo** und kollidiert mit jeder parallelen
  Agenten-Session. Er braucht ein Fenster, in dem sonst niemand an `libs/` schreibt, und läuft in
  einem Zug (Migration auf das eigene Repo anwenden, dann von Hand nachziehen).
- **Die eigene Migration zuerst am SDK-Repo beweisen**: Storybook, docs-examples, Studio und
  Timetrack sind die ersten Konsumenten von `et update`, vor fifagg.
- **Konsumenten (Tom, 26.11.):** fifagg und fut sind nicht die einzigen. Die meisten Projekte
  nutzen noch das alte Theming (`@ethlete/theming` und die Laufzeit-Themes); dafür gibt es schon
  Migrationen. Sie migrieren „eins nach dem anderen“ weiter: alt → heutiger Stand → Zielbild.
  Folgen für den Builder: Die neuen Migrationen hängen sich **hinter** die bestehenden
  (`legacy-color-themes`, `color-theme-variants`, `surface-interaction-swatch`) und setzen deren
  Ergebnis voraus. Jede bestehende Migration bleibt lauffähig, auch nachdem Schritt 5
  `legacy-theming.ts` entfernt hat: sie darf dann nur Namen schreiben, die die Folgemigration
  kennt. Beweis: ein Ketten-Spec, der ein Fixture auf dem alten Stand durch alle Migrationen bis
  zum Zielbild schickt. Auf dem heutigen System sind fifagg und in fut die Hub-App (Tom, 26.11.); die Zählungen „fut“ in
  diesem Plan stammen aus `fut-frontend` und sind nicht nach App getrennt. fifagg bleibt die
  Bildreferenz, weil es dem heutigen Stand am nächsten ist; die Hub-App ist die zweite.

**Bildvergleich (Tom, 26.11.):** fifagg hat eine visuelle e2e-Test-Suite. Sie ist der Bildvergleich
dieses Plans: überall, wo „Bildaufnahme“ oder „Bildvergleich“ steht, ist diese Suite gemeint,
keine eigene Aufnahme. Vor Schritt 0 läuft sie einmal auf dem unveränderten Stand als Referenz,
nach jedem Schritt mit `et update` erneut, und am Ende als Abnahme. Erwartete Abweichung: nur
B-65. Vom Builder zu klären (nicht nachgelesen): wie die Suite gestartet wird, ob sie Hover-
und Gedrückt-Zustände und Overlays abdeckt, und ob die Hub-App in fut etwas Vergleichbares hat.
Was die Suite nicht abdeckt, prüft die Messlatte auf der Demo-Seite.

## 8. Entscheidungen

Offen: nichts. Tom hat das Zielbild am 26.11. bestätigt („passt“).

Entschieden:

- (26.11., Tom) Ziel ist ein funktionierendes System; fifagg ändert sein Aussehen nicht,
  ausgenommen sichtbare Fehler.
- (vorab, Tom) Kein neues Token als schnelle Lösung; die Lücke bleibt bis zur Revision sichtbar;
  das SDK liefert keine Theme-Namen; kein ADR.
- (26.11., Tom) Umfang: „nur neutrale ‚surface themes‘ zustände“. Ton-Zustände, Ton-Rampe
  und Fokus-Ring sind nicht Teil der Revision.
- (26.11., Tom) Ein Flicken, der nur Tokens anbaut, ist nicht das Ziel: „wir machen das system
  was niemand versteht nur noch größer?“ Die Revision muss das System kleiner und verständlich
  machen.
- (26.11., Tom) Öffentliche Namen (Tokens, Direktiven, Theme-Felder) dürfen brechen, wenn jede
  Änderung eine Auto-Migration in `et update` mitbringt und das Bild in fifagg gleich bleibt.
- (26.11., Tom) Die Doku bekommt eine Demo, die das ganze Theming-System in Aktion zeigt.
- (26.11., technisch, Fable) Zustände als durchscheinende Tönung mit Stärke je Komponente, am
  Verbraucher gemischt; „Hintergrund der nächsten Ebene“ als Baustein für Apps; farbige
  Zustands-Tokens nehmen weiter eine Farbe an; Utilities für Apps ja; kein Generator-Abbruch bei
  Farbgleichheit.
- (26.11., Tom) Wörter wie `ink` versteht niemand; das System muss transparenter werden. Folge:
  Wortliste S9, jeder Name in einem Satz erklärbar.
- (26.11., Tom) Das Konzept „Color“ heißt künftig `tone` („ja tone ist gut“). `accent` verworfen
  (Material-Assoziation primary vs. accent). Flächen-Textfarbe wird `--et-surface-text`.
- (26.11., Tom) Direktiven für Apps: `etSurface` und `etTone`; der Rest intern oder gestrichen.
- (26.11., Tom) Die internen `…Interactive`-Direktiven entfallen (S10); Zustände stehen im CSS
  der Komponente, das Theme liefert jeden Zustand unter eigenem Namen.
- (26.11., Tom) Die meisten Projekte nutzen noch das alte Theming; sie migrieren über die
  bestehenden Migrationen schrittweise weiter bis zum Zielbild.
