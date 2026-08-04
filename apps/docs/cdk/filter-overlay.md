# Filter overlay

A scaffold for the "filter sheet" pattern: an [overlay](/cdk/overlays) that edits a copy of your filter form, previews how many results the current selection would return, and only writes back to the real form when the user submits.

::: warning Superseded by @ethlete/components
New code should use the [components filter overlay](/components/filter-overlay). `FilterOverlayService`
becomes `injectFilterOverlay()` - an inject function rather than an Angular service class - and
`FilterOverlayResult` keeps its shape. This page documents the CDK version, which still receives bug fixes.
:::

```ts
providers: [
  provideFilterOverlayConfig({
    form: this.filterForm,
    defaults: { sport: null, country: null },
    searchPreviewQueryFn: (formValue) => searchQuery.prepare({ queryParams: formValue }),
  }),
  FilterOverlayService,
],
```

```ts
import { FilterOverlayService, provideFilterOverlayConfig } from '@ethlete/cdk';
```

## The working copy

The service clones the form you hand it and works on the clone. Nothing you type in the overlay touches the page behind it until `submit()` runs - which is what makes "cancel" free and lets the preview query run against a selection the user hasn't committed to yet.

| Member           | Purpose                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `form`           | The cloned form to bind your controls to.                                                            |
| `formValue`      | Signal of the clone's current value.                                                                 |
| `submit()`       | Writes the clone's value back to the original form and closes with `{ didUpdate: true, formValue }`. |
| `reset()`        | Patches the clone back to `defaults`. Throws when no `defaults` were configured.                     |
| `close(result?)` | Closes without writing back - the result defaults to `{ didUpdate: false }` shape.                   |

The overlay closes with a `FilterOverlayResult`: `{ didUpdate: false }` when the user backed out, `{ didUpdate: true, formValue }` when they submitted. Read it from the overlay ref's `afterClosed()`.

## Result preview

`searchPreviewQueryFn` turns the current form value into a query, which re-runs as the user changes filters. Its result feeds the submit button's label, so the button can say "Show 42 results" before anything is applied:

| Option                 | Default                         | Purpose                                                   |
| ---------------------- | ------------------------------- | --------------------------------------------------------- |
| `form`                 | required                        | The form to clone and edit.                               |
| `defaults`             | -                               | Value used by `reset()`.                                  |
| `searchPreviewQueryFn` | -                               | Builds the preview query from the current form value.     |
| `totalHitsExtractorFn` | reads `response.totalHits`      | Pulls the count out of your API's response shape.         |
| `submitButtonConfigFn` | `defaultSubmitButtonConfigFn()` | Turns query state + hit count into `{ label, disabled }`. |

Without a `totalHitsExtractorFn`, the response must have a `totalHits` property - anything else logs an error and yields `null`.

Read `submitButtonConfig()` in the template and bind both halves:

```html
<button [disabled]="filterOverlay.submitButtonConfig().disabled" (click)="filterOverlay.submit()" type="button">
  {{ filterOverlay.submitButtonConfig().label }}
</button>
```

`defaultSubmitButtonConfigFn` covers the states you'd otherwise write by hand - loading, error, no results, one result, _n_ results, and "more than 250 results" above that cap - and ships English and German strings. It only speaks German if you wire it up explicitly, since the config function the service calls passes no locale:

```ts
submitButtonConfigFn: (config) => defaultSubmitButtonConfigFn({ ...config, locale: 'de' }),
```

`searchPreviewQueryState()` and `searchPreviewTotalHits()` are exposed too, for a hit count somewhere other than the button.

## Related

- [Rich filter](/cdk/rich-filter) - the scroll-aware bar that typically opens this overlay.
- [Overlays](/cdk/overlays) - the strategies and content shell the filter overlay is rendered with.
