# Filter overlay

A filter panel with an explicit apply: the reader edits a **draft** of the page's filters, sees how many results
those filters would return, and commits — or dismisses, which discards. Built on the signals
[query form](/query/query-forms), so applying also updates the URL and resets dependent fields.

Import `FILTER_OVERLAY_IMPORTS` for the controls; `provideFilterOverlay` goes in the overlay's providers.

```ts
export class TeamsPageComponent {
  private overlayManager = injectOverlayManager();

  protected filters = createQueryForm({ fields: TEAM_FILTER_FIELDS }).observe();

  protected openFilters() {
    this.overlayManager.open(TeamFiltersOverlayComponent, {
      strategies: bottomSheetToSidebarOverlayStrategy(),
      providers: [
        provideFilterOverlay({
          queryForm: this.filters,
          preview: filterOverlayPreviewFromQuery({
            queryCreator: searchTeams,
            args: (value) => ({ queryParams: { ...value, limit: 1 } }),
          }),
        }),
      ],
    });
  }
}
```

```ts
@Component({
  template: `
    <et-input [formField]="filters.draft.fields.search" />

    <button et-button etFilterOverlayReset variant="transparent">{{ filters.labels().reset }}</button>
    <button #submit="etFilterOverlaySubmit" et-button etFilterOverlaySubmit>{{ submit.label() }}</button>
  `,
})
export class TeamFiltersOverlayComponent {
  protected filters = injectFilterOverlay<TeamFilterValue>();
}
```

## Live demo

<StoryEmbed id="components-filter-overlay--default" height="620px" />

## Edit a copy, then commit

`provideFilterOverlay` takes your page's query form and calls `branch()` on it — a detached clone with its own
value, no URL writes and no reset graph. Every control in the overlay binds to the **branch**, so:

- nothing the reader does affects the page until they submit;
- dismissing the panel (Escape, backdrop, the back button) discards, which is what makes a filter panel safe to
  close;
- `submit()` writes the draft back through `queryForm.setValue()`, so the reset graph fires (a new search
  resetting the page number) and the URL updates. It then closes with
  `{ didUpdate: true, value }` — `{ didUpdate: false }` on a discard.

`reset()` puts the draft back to the query form's defaults without closing. Unlike cdk's version it needs no
configured `defaults`, because the query form already knows them.

## The submit button reports the count

This is the feature's point, not decoration: the button says **"Show 42 results"** rather than "Apply", so the
reader can tell what a filter combination does before committing to it. It disables itself while the count is
pending, when the count failed, and when the answer is zero.

`filterOverlayPreviewFromQuery` is the usual way to feed it — one query, re-executed as the draft changes:

```ts
preview: filterOverlayPreviewFromQuery({
  queryCreator: searchTeams,
  // Ask for as few rows as the endpoint allows: only the total is used.
  args: (value) => ({ queryParams: { ...value, limit: 1 } }),
  toTotalHits: (response) => response.totalHits, // the default
});
```

It is a factory of a factory because the query has to be created in the _overlay's_ injection context, which only
exists once the overlay is open — a query built at config time would belong to the page and outlive the panel.

Debouncing is the query form's job. The branch's value is already debounced wherever a field asked for it, so
typing in a search box does not fire a request per keystroke.

For a count that doesn't come from a single query — a local collection, an aggregate of several endpoints — write
the `FilterOverlayPreview` shape yourself: three signals (`loading`, `hasError`, `totalHits`).

**Without a preview** the button simply reads "Show results", enabled.

<StoryEmbed id="components-filter-overlay--without-preview" height="420px" />

::: warning cdk parity note
cdk's default submit-button resolver returned its _loading_ state when there was no query state and no total —
which is exactly the no-preview case, so a filter overlay without a search preview had a permanently disabled
submit button. Fixed here.
:::

### Label thresholds

| Count                 | Label                      | Enabled |
| --------------------- | -------------------------- | ------- |
| pending               | "Loading results…"         | no      |
| failed                | "An error occurred"        | no      |
| `0`                   | "No results found"         | no      |
| `1`                   | "Show one result"          | yes     |
| `2 … maxCountedHits`  | "Show N results"           | yes     |
| `> maxCountedHits`    | "Show more than N results" | yes     |
| no preview configured | "Show results"             | yes     |

`maxCountedHits` defaults to `250`: past a few hundred the exact number stops telling the reader anything they can
act on. Strings come from `injectLocale()` (English and German ship) and can be overridden with
`provideFilterOverlayLabels`; `submitButton` in the config replaces the resolver wholesale.

## A routed panel

A filter panel with more than a handful of options wants pages, not a single scrolling column. Because
`provideFilterOverlay` sits in the overlay's providers, every routed page can `injectFilterOverlay()` and edit the
same draft:

```ts
providers: [
  provideOverlayRouter({
    routes: [
      { path: '/', component: FiltersMainPageComponent },
      { path: '/region', component: FiltersRegionPageComponent },
      { path: '/division', component: FiltersDivisionPageComponent },
    ],
  }),
  provideFilterOverlay({ queryForm: this.filters, preview: … }),
],
```

The shell holds the submit and reset buttons in the overlay footer, so they stay put as the reader moves between
pages. See [overlays → routing](/components/overlays) for the router itself, and
[`etOverlayBackOrClose`](/components/overlays) for a back button that closes on the first page.

## The trigger and its badge

Pair it with [floating action](/components/floating-action) so the trigger stays reachable down a long results
list, and use the query form's `activeFilterCount` for the badge:

```html
<div etFloatingAction>
  <div etFloatingActionAnchor>
    <button (click)="openFilters()" et-button etFloatingActionTrigger>
      Filters @if (filters.activeFilterCount() > 0) {
      <et-chip size="sm">{{ filters.activeFilterCount() }}</et-chip>
      }
    </button>
  </div>

  <ul etFloatingActionScope>
    …
  </ul>
</div>
```

::: tip `activeFilterCount` is not "fields that changed"
The query form deliberately leaves navigation state — `search`, `page`, `sort` and friends — out of that count,
because they are not filters. That is right for a badge, and wrong as a test for "is there anything to reset":
use `isPristine()` for that, which is what `etFilterOverlayReset` does.
:::

## API

### `provideFilterOverlay(config)`

| Config           | Type                                           | Default | Purpose                                        |
| ---------------- | ---------------------------------------------- | ------- | ---------------------------------------------- |
| `queryForm`      | `QueryFormSignals` (**required**)              | —       | The page filters the overlay drafts from.      |
| `preview`        | `(draftValue) => FilterOverlayPreview`         | —       | The live result count.                         |
| `maxCountedHits` | `number`                                       | `250`   | Above this, the label stops counting exactly.  |
| `submitButton`   | `(state, labels) => FilterOverlaySubmitButton` | —       | Replaces the built-in label/disabled resolver. |

### `injectFilterOverlay<TValue>()`

| Member                | Type                                | Purpose                                            |
| --------------------- | ----------------------------------- | -------------------------------------------------- |
| `draft`               | `FilterOverlayDraft<TValue>`        | The branch: `fields`, `value()`, `patchValue()`, … |
| `preview`             | `FilterOverlayPreview \| null`      | The live count, if configured.                     |
| `submitButton()`      | `Signal<FilterOverlaySubmitButton>` | `{ label, disabled }`.                             |
| `labels()`            | `Signal<FilterOverlayLabels>`       | Strings after locale + overrides.                  |
| `activeFilterCount()` | `Signal<number>`                    | Draft filters that are set — for a badge.          |
| `hasChanges()`        | `Signal<boolean>`                   | Draft differs from what is applied.                |
| `isPristine()`        | `Signal<boolean>`                   | Every field is at its default — nothing to reset.  |
| `submit()`            | `() => void`                        | Apply and close.                                   |
| `reset()`             | `() => void`                        | Draft back to defaults, panel stays open.          |
| `discard()`           | `() => void`                        | Close without applying.                            |

`TValue` is the filters' **value** shape, not the field map:

```ts
const createTeamFilters = () => createQueryForm({ fields: TEAM_FILTER_FIELDS });
type TeamFilterValue = FilterOverlayValueOf<ReturnType<typeof createTeamFilters>>;
```

Naming the field map would be the obvious thing, and it doesn't typecheck: `QueryFieldDef<T>` can carry a
`valueToQueryParam: (value: T) => unknown`, and a concrete field map therefore doesn't satisfy
`Record<string, QueryFieldDef<unknown>>` when written out explicitly. `FilterOverlayValueOf` sidesteps it.

### Controls

| Directive                 | On         | Behavior                                                            |
| ------------------------- | ---------- | ------------------------------------------------------------------- |
| `[etFilterOverlaySubmit]` | `<button>` | Applies. Disabled per the preview; `label()` is what it should say. |
| `[etFilterOverlayReset]`  | `<button>` | Resets the draft. Disabled while `isPristine()`.                    |

## Error codes

Filter overlay throws in the `ET42xx` range — see [error codes](/components/error-codes#filter-overlay-et42xx).

::: info Migrating from `@ethlete/cdk`
This replaces `provideFilterOverlayConfig` / `FilterOverlayService`. The semantics are kept — draft isolation,
explicit submit, `reset()`, the results-preview-driven submit button — and the layers underneath changed:

- **Signal forms, not `FormGroup`.** `queryForm` replaces `form` + `defaults`; the draft is
  `queryForm.branch()` rather than `cloneFormGroup()`. Apps still on reactive forms keep using the cdk original.
- **Current query client.** `searchPreviewQueryFn` (typed against `AnyV2Query`, `queryComputed`,
  `switchQueryState`) becomes `filterOverlayPreviewFromQuery`, or any three signals.
- **`injectLocale()`**, not a `locale: 'en' | 'de'` parameter.
- `FilterOverlayResult`'s payload is `value` rather than `formValue`.
  :::
