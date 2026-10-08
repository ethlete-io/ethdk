# Localization

The SDK ships English and expects you to override it. Nothing here is a translation
framework: there is one locale signal, one shape for overriding strings, and a list of
the places that have any.

Three calls localize an app completely:

```ts
import { provideLocale } from '@ethlete/core';
import { provideDateLocale, providePaginationLabels /* … */ } from '@ethlete/components';
import { de } from 'date-fns/locale';

bootstrapApplication(AppComponent, {
  providers: [
    provideLocale('de'), // 1. the locale signal everything reacts to
    provideDateLocale(de), // 2. the date-fns locale for dates and calendars
    providePaginationLabels({ next: 'Weiter' }), // 3. one call per domain you use
  ],
});
```

## 1. The locale signal

[`provideLocale()` / `injectLocale()`](/core/providers) hold a single
`currentLocale: WritableSignal<string>`, defaulting to `'en'`. Everything below reacts to
it, so switching language at runtime needs no reload:

```ts
injectLocale().currentLocale.set('de');
```

## 2. The date-fns locale

`DATE_LOCALE` is the one thing the locale signal cannot derive. A date-fns locale is a
module with its own formatting rules, and importing all of them to look one up would put
all of them in your bundle - so you pass it yourself:

```ts
import { de } from 'date-fns/locale';

provideDateLocale(de);
```

It drives month and weekday names, the calendar's cell labels, and how typed dates parse
and display. Miss it and dates silently stay en-US while every other string moves;
`injectDateLocale()` warns once in dev mode when the locale is non-English and this token
was never provided.

## 3. Label tokens

Every domain with strings of its own exposes exactly one pair - `provide<Domain>Labels` to
localize a subtree, `inject<Domain>Labels()` to read the result. All of them are built with
`defineLabels` from `@ethlete/core`, so all of them behave identically:

```ts
// fixed wording
provideTableLabels({ empty: 'Keine Daten', filterSearch: 'Suchen…' });

// or driven by your i18n library, re-resolved whenever the locale signal changes
provideTableLabels((locale) => ({
  empty: translate('table.empty', locale),
  sortAction: (header, next) => translate(`table.sort.${next ?? 'clear'}`, locale, { header }),
}));
```

Three things hold for every token:

- **Partial.** What you leave out keeps its English default (or, for
  `QUERY_ERROR_LABELS`, `FILTER_OVERLAY_LABELS` and `COMMAND_PALETTE_LABELS`, whatever the
  current locale resolves to - all three ship German as well). Overriding a single key is fine.
- **A signal out.** `inject<Domain>Labels()` returns `Signal<Labels>`, because both the
  locale and the provided set can change at runtime. Read it in a template or computed;
  never destructure it once.
- **Scoped like any provider.** App-wide in `bootstrapApplication`, or per route/component
  to give one screen different wording.

Strings that take a value are functions, so a translation decides word order rather than
inheriting it from an English concatenation:

```ts
providePaginationLabels({
  page: (page) => `Seite ${page}`,
  range: ({ start, end, totalItems }) => `Zeige ${start}–${end} von ${totalItems}`,
});
```

### Per instance

Most components also take a `labels` input (or a single-string input like `clearLabel`)
that layers over the provided set - for the one paginator that needs different wording,
not for translating:

```html
<et-pagination [labels]="{ navigation: 'Suchergebnisseiten' }" />

<et-skeleton [labels]="{ loadingContent: 'Lade Ergebnisse' }" />
```

Leaving such an input unset (`null`) is what makes it fall through to the token, so an app
that provides labels needs no per-instance wiring at all.

### Every token

| Token                     | Provide with                  | Covers                                                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FORM_FIELD_LABELS`       | `provideFormFieldLabels`      | `mixed`, `clear`, `selectAll` - shared by **every** form control - the rating's value text, the counter announcements and the default error texts (`errorRequired`, `errorMin`, `errorMax`, `errorMinLength`, `errorMaxLength`, `errorPattern`, `errorEmail`) |
| `INPUT_LABELS`            | `provideInputLabels`          | Number steppers and parse error, password reveal, Caps Lock warning                                                                                                                                                                                           |
| `DATE_TIME_LABELS`        | `provideDateTimeLabels`       | Picker triggers, range start/end, the pickers' date/time tabs, the range presets, the zoned second reading, parse errors, the range validators' messages                                                                                                      |
| `CALENDAR_LABELS`         | `provideCalendarLabels`       | Step/zoom controls of each view, week column (names come from `DATE_LOCALE`)                                                                                                                                                                                  |
| `TIME_PICKER_LABELS`      | `provideTimePickerLabels`     | The ring handles' names (`time`, `startTime`, `endTime`), the empty hint, a range's duration (`durationHours`, `durationMinutes`) and `endsNextDay`                                                                                                           |
| `SELECT_LABELS`           | `provideSelectLabels`         | Panel loading/empty state, load more, create-a-value, query adapter error fallback                                                                                                                                                                            |
| `COLOR_INPUT_LABELS`      | `provideColorInputLabels`     | The color picker panel: its dialog name, each surface, the entry field and its notation names, the preset swatches (`swatch`), the eyedropper, the `invalidColor` and `contrastTooLow` validator messages                                                     |
| `CASCADER_LABELS`         | `provideCascaderLabels`       | Column states, load error fallback, retry, back, search, root column heading                                                                                                                                                                                  |
| `PHONE_INPUT_LABELS`      | `providePhoneInputLabels`     | Country selector and its search (country names come from `Intl`)                                                                                                                                                                                              |
| `SLIDER_LABELS`           | `provideSliderLabels`         | A range slider's two thumbs                                                                                                                                                                                                                                   |
| `DROPZONE_LABELS`         | `provideDropzoneLabels`       | Drop prompt, entry actions, upload-failed message, file rejection messages, uploading status                                                                                                                                                                  |
| `RICH_TEXT_EDITOR_LABELS` | `provideRichTextEditorLabels` | Toolbars, every tool, link editor, table/align tools, token popup                                                                                                                                                                                             |
| `CHIP_LABELS`             | `provideChipLabels`           | A removable chip's remove button                                                                                                                                                                                                                              |
| `AVATAR_LABELS`           | `provideAvatarLabels`         | The accessible name of an avatar group's `+N` overflow avatar                                                                                                                                                                                                 |
| `COPY_BUTTON_LABELS`      | `provideCopyButtonLabels`     | The "Copied" and "Copy failed" announcements                                                                                                                                                                                                                  |
| `PROGRESS_STEP_LABELS`    | `provideProgressStepLabels`   | The hidden state text of a complete, success, warning or error step                                                                                                                                                                                           |
| `STAT_TILE_LABELS`        | `provideStatTileLabels`       | The hidden direction word before a delta (`up`, `down`, `unchanged`) and a missing value (`noValue`)                                                                                                                                                          |
| `TABLE_LABELS`            | `provideTableLabels`          | Empty/error text, sorting, filtering, column menu, selection                                                                                                                                                                                                  |
| `TREE_LABELS`             | `provideTreeLabels`           | Root loading and empty states, a failed level's retry hint                                                                                                                                                                                                    |
| `PAGINATION_LABELS`       | `providePaginationLabels`     | Controls, page items, range readouts, jump-to-page                                                                                                                                                                                                            |
| `BREADCRUMB_LABELS`       | `provideBreadcrumbLabels`     | Landmark name, overflow control                                                                                                                                                                                                                               |
| `CAROUSEL_LABELS`         | `provideCarouselLabels`       | Region, slides, prev/next, play/pause, dots                                                                                                                                                                                                                   |
| `GRID_LABELS`             | `provideGridLabels`           | Interactive/read-only grid names, the fallback item name (`item`, default `'Grid item'`), item remove                                                                                                                                                         |
| `CHART_LABELS`            | `provideChartLabels`          | Every chart's data table headers, the pie total, the Sankey in/out/separator words and its key-hint function (`sankeyLinkKeyHint`)                                                                                                                            |
| `LOADER_LABELS`           | `provideLoaderLabels`         | What brand loaders, stream loading overlays and skeletons announce                                                                                                                                                                                            |
| `NOTIFICATION_LABELS`     | `provideNotificationLabels`   | The dismiss button                                                                                                                                                                                                                                            |
| `ALERT_DIALOG_LABELS`     | `provideAlertDialogLabels`    | The confirm, cancel and acknowledge actions of `createAlertDialogOpener` dialogs                                                                                                                                                                              |
| `UNSAVED_CHANGES_LABELS`  | `provideUnsavedChangesLabels` | Title, message, discard and keep-editing actions of the dialog `provideUnsavedChangesAlertDialog()` opens                                                                                                                                                     |
| `STREAM_LABELS`           | `provideStreamLabels`         | Consent gate, failure overlay, PiP placeholder and controls, frame title                                                                                                                                                                                      |
| `BANNER_LABELS`           | `provideBannerLabels`         | A dismissible banner's dismiss button                                                                                                                                                                                                                         |
| `KBD_LABELS`              | `provideKbdLabels`            | The printed label and spoken name of each named key (`Ctrl`/`Strg`, "Control"), per platform                                                                                                                                                                  |
| `COMMAND_PALETTE_LABELS`  | `provideCommandPaletteLabels` | Search placeholder and label, the no-results and no-commands states - **English and German ship**                                                                                                                                                             |
| `MATCH_LABELS`            | `provideMatchLabels`          | Match status (`tbd`, `live`, `finished`, `scheduled`), outcomes, scores, seeds, match names                                                                                                                                                                   |
| `STANDINGS_LABELS`        | `provideStandingsLabels`      | Table caption, column headers and their full names, form results, legend, pick mode                                                                                                                                                                           |
| `SCHEDULER_LABELS`        | `provideSchedulerLabels`      | Navigation, view switcher, all-day, more appointments, the appointment editor's actions                                                                                                                                                                       |
| `BRACKET_LABELS`          | `provideBracketLabels`        | Round headers, section names, champion, slot descriptions (winner/loser of, seed, bye, …)                                                                                                                                                                     |
| `QUERY_ERROR_LABELS`      | `provideQueryErrorLabels`     | Status titles/messages and retry - **English and German ship**                                                                                                                                                                                                |
| `FILTER_OVERLAY_LABELS`   | `provideFilterOverlayLabels`  | Result-count submit button and reset - **English and German ship**                                                                                                                                                                                            |
| `CONTENTFUL_FILE_LABELS`  | `provideContentfulFileLabels` | `et-contentful-file`'s size text (`fileSize`) - exported from `@ethlete/contentful`, not `@ethlete/components`                                                                                                                                                |

## Your own strings vs the library's

The tokens above cover strings the library wrote. Text you supply travels a different
route, because there is nothing to override - you pass the words in:

- **Content.** Labels, hints, placeholders, options, table headers, notification messages,
  empty-state templates: whatever you write is what renders. Translate it before you bind
  it.
- **Validation messages** come from your signal-forms schema
  ([`forms`](/components/forms#custom-error-messages)), not from a token.
- **Page titles and meta tags** take a locale-aware `transformer(text, locale)` on
  `TitleConfig` / `MetaConfig` ([SEO](/core/seo)). That hook exists for the opposite reason
  the tokens do: the strings are yours, so the SDK has no default to replace and instead
  hands each one to your translator as the locale changes.

## What is deliberately not localizable

- **`et-query-devtools`.** A developer tool, read by developers, in English.
- **Error messages thrown by the library** (`RuntimeError`, the `ERROR_CODES` tables). They
  are addressed to the developer who mis-wired a component, and several are stripped in
  production builds. See [error codes](/components/error-codes).
- **Brand names.** `STREAM_LABELS.playerFrame` takes the platform's name and localizes only
  the wording around it (`(platform) => \`${platform} player\``).

## Writing a component that has strings

If you add a component with a string of its own, give its domain a label token rather than
a literal - `defineLabels` is the whole mechanism:

```ts
import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

export type WidgetLabels = { collapse: string; expand: string };

export const DEFAULT_WIDGET_LABELS: WidgetLabels = { collapse: 'Collapse', expand: 'Expand' };

const WIDGET_LABELS_DEF = /* @__PURE__ */ defineLabels<WidgetLabels>('WIDGET_LABELS', DEFAULT_WIDGET_LABELS);

export const provideWidgetLabels = /* @__PURE__ */ toProvideFn(WIDGET_LABELS_DEF);
export const injectWidgetLabels = /* @__PURE__ */ toInjectFn(WIDGET_LABELS_DEF);
export const WIDGET_LABELS = /* @__PURE__ */ toToken(WIDGET_LABELS_DEF);
```

Four statements, not one, and the `/* @__PURE__ */` annotations are load-bearing: a destructured
`const [a, b] = f()` is a shape no bundler can drop, so the one-liner used to put **every** domain's
default-strings table into every app that imported anything from the package. See
[core utilities](/core/utilities#why-four-statements-instead-of-one).

`defineLabels` also accepts a locale-derived default set - `defineLabels('X_LABELS', (locale) => …)` -
which is how `QUERY_ERROR_LABELS` ships two languages while still taking partial overrides.
