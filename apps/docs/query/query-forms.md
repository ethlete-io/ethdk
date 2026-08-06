# Query forms

A **query form** binds on-screen controls (a search input, a sort select, filter
checkboxes) to typed fields that debounce, serialize to the URL query params, and
feed your query args - so a filtered, sorted, paged list is fully described by its
URL and survives reload, share and back/forward.

There are two implementations:

- **`defineQueryForm`** - the signals-first form (recommended for new code).
  Built on [Angular signal forms](https://angular.dev/guide/forms/signals), so
  fields bind to `@ethlete/components` controls with `[formField]` and everything
  is a signal.
- **`QueryForm`** - the original reactive-forms class. Unchanged and still
  exported; see [below](#legacy-queryform).

## Quickstart

```ts
import { Component } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { InputDirective } from '@ethlete/components';
import { defineQueryForm, searchQueryField, sortQueryField, queryField, withArgs } from '@ethlete/query';

@Component({
  imports: [FormField, InputDirective],
  template: `<input [formField]="qf.fields.search" etInput placeholder="Search" />`,
})
export class UsersComponent {
  qf = defineQueryForm({
    fields: {
      search: searchQueryField(),
      sort: sortQueryField(),
      page: queryField<number>({ defaultValue: 1, isResetBy: ['search', 'sort'] }),
    },
  }).observe();

  users = getUsers(
    withArgs(() => {
      const { search, sort, page } = this.qf.value();

      return { queryParams: { query: search, sortBy: sort?.active, sortOrder: sort?.direction, page } };
    }),
  );
}
```

- `fields` maps a name to a **field creator**. Each field is exposed on
  `qf.fields.<name>` as a signal-forms field - bind it to any control that
  implements the signal-forms control contract (every `@ethlete/components` form
  control does) with `[formField]`.
- `qf.value()` is the **committed** value signal - debounced and reset-resolved -
  ready to feed straight into query args.
- `.observe()` starts syncing with the URL. Call it once, after construction.

## Field creators

| Creator                    | Value type          | Notes                                                                            |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------- |
| `queryField<T>()`          | `T \| null`         | Generic field. Auto-coerces URL strings to number/boolean unless told otherwise. |
| `searchQueryField()`       | `string \| null`    | Debounced 300ms; clearing applies immediately (`disableDebounceIfFalsy`).        |
| `sortQueryField()`         | `Sort \| null`      | Serialized as `active:direction` (e.g. `name:asc`).                              |
| `stringArrayQueryField()`  | `string[] \| null`  |                                                                                  |
| `numberArrayQueryField()`  | `number[] \| null`  |                                                                                  |
| `booleanArrayQueryField()` | `boolean[] \| null` |                                                                                  |
| `dateQueryField()`         | `Date \| null`      | Expects a `Date`-parseable string in the URL.                                    |
| `dateArrayQueryField()`    | `Date[] \| null`    |                                                                                  |

Every creator accepts the same options:

| Option                    | Default                          | Description                                                                                                     |
| ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `defaultValue`            | `null`                           | Value the field starts at. Elided from the URL and ignored by the filter count. A function is evaluated lazily. |
| `debounce`                | - (`300` for `searchQueryField`) | Milliseconds to wait before committing a change.                                                                |
| `disableDebounceIfFalsy`  | `false` (`true` for search)      | Commit immediately when the new value is falsy (e.g. clearing a search).                                        |
| `appendToUrl`             | `true`                           | Write the field to the URL.                                                                                     |
| `appendDefaultValueToUrl` | `false`                          | Write the field even when it holds its default.                                                                 |
| `isResetBy`               | -                                | Sibling field(s) whose change resets this field to its default (single key or list). Transitive - see below.    |
| `skipInFilterCount`       | `false`                          | Exclude from `activeFilterCount`.                                                                               |
| `skipAutoTransform`       | `false`                          | Skip the URL string → number/boolean coercion.                                                                  |
| `queryParamToValue`       | -                                | Custom URL → value transform.                                                                                   |
| `valueToQueryParam`       | -                                | Custom value → URL transform.                                                                                   |

## Form API

| Member                                      | Description                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `fields`                                    | The bindable signal-forms field tree (`qf.fields.search`).                        |
| `value: Signal`                             | The committed (debounced, reset-resolved) value.                                  |
| `previousValue: Signal`                     | The committed value before the most recent change.                                |
| `changes: Signal`                           | `{ previousValue, currentValue }` of the most recent change.                      |
| `activeFilterCount: Signal<number>`         | Count of non-default fields, excluding the ignored keys and `skipInFilterCount`.  |
| `defaultValue`                              | The default value of the whole form.                                              |
| `setValue(value, { skipResets? })`          | Replace the whole value.                                                          |
| `patchValue(partial, { skipResets? })`      | Merge a partial value.                                                            |
| `resetFieldToDefault(key, { skipResets? })` | Reset one field.                                                                  |
| `resetFieldsToDefault(keys, …)`             | Reset several fields.                                                             |
| `resetAllFieldsToDefault({ skipFields? })`  | Reset everything (optionally skipping some fields).                               |
| `branch()`                                  | A detached editor over the same fields - see [Filter overlays](#filter-overlays). |
| `observe(options?)`                         | Start URL sync. Returns the form for chaining.                                    |
| `unobserve()`                               | Stop syncing and remove this form's params from the URL.                          |

### `isResetBy` is transitive

A reset counts as a change for the next hop, so a chain clears all the way down. Declare each field's **direct** dependency only - the closure is resolved for you:

```ts
defineQueryForm({
  fields: {
    country: queryField<string>(),
    league: queryField<string>({ isResetBy: 'country' }),
    team: queryField<string>({ isResetBy: 'league' }),
  },
});
// changing `country` clears `league` and `team`
```

The whole cascade settles before the value is committed, so it drives **one** query execution, not one per hop. A cyclic graph stops after ten passes with a dev-mode warning.

### `activeFilterCount`

Counts fields that differ from their default, excluding navigation state:
`page`, `skip`, `take`, `limit`, `sort`, `sortBy`, `sortOrder`, `query`, `search`
are always ignored, plus any field created with `skipInFilterCount`.

## URL sync

`observe()` accepts:

| Option               | Default | Description                                                    |
| -------------------- | ------- | -------------------------------------------------------------- |
| `writeToQueryParams` | `true`  | Sync the committed value to the URL.                           |
| `syncOnNavigation`   | `true`  | Apply URL → form on navigation (back/forward, external links). |
| `replaceUrl`         | `false` | Replace the history entry instead of pushing a new one.        |

Serialization rules:

- **Defaults are elided** - a field at its default is removed from the URL (unless
  `appendDefaultValueToUrl` is set), keeping URLs clean.
- **`null`** is written as the `ET_NULL__` sentinel (only when it isn't the default).
- **Sort** is `active:direction` (`name:asc`). This matches the table system's URL
  adapter, so the two interoperate.
- **`queryParamPrefix`** namespaces every key (`prefix-page`), so two forms can
  share a route:

```ts
defineQueryForm({ fields: { page: queryField<number>({ defaultValue: 1 }) }, queryParamPrefix: 'users' });
// → ?users-page=2
```

## Seeing a form in the devtools

With [`provideQueryDevtools()`](/components/query-devtools) installed, every form
registers itself in the panel's **Forms** tab: its fields, their committed and live
values, what each writes to the URL, and the query it drives - the last one discovered
from the `qf.value()` read inside `withArgs`, not from a naming convention.

`name` is what the tab calls the form. It defaults to a string `queryParamPrefix`, and
to `form` without one, so a route with several forms is worth naming:

```ts
defineQueryForm({ name: 'users', queryParamPrefix: 'users', fields: { … } });
```

Outside of devtools `name` does nothing - it is never read at runtime.

## Reset the page on an out-of-range error

When a filter shrinks a result set below the current page, the backend returns an
out-of-range error. The [`withPageResetOnError`](/query/features#withpageresetonerror)
query feature resets the form's page field so the query re-runs on a valid page:

```ts
import { withArgs, withPageResetOnError } from '@ethlete/query';

users = getUsers(
  withArgs(() => ({ queryParams: this.qf.value() })),
  withPageResetOnError({ reset: () => this.qf.resetFieldToDefault('page') }),
);
```

It reacts to HTTP `416`, and to a `500` carrying a Pagerfanta out-of-range detail
(the dev-mode shape); override the trigger with `when`.

## Filter overlays

`branch()` returns a **detached editor** over the same fields, seeded with the
current committed value and with no URL sync. Bind it inside a filter overlay,
let the user edit freely, then write it back on "apply" - or drop it on "cancel":

```ts
draft = this.qf.branch();

apply() {
  this.qf.setValue(this.draft.value());
}
```

The branch exposes `fields`, `value`, `activeFilterCount`, `setValue`,
`patchValue`, `resetFieldToDefault` and `resetAllFieldsToDefault`.

## Legacy `QueryForm`

The original `QueryForm` class (with `QueryField`, `SearchQueryField`,
`SortQueryField`, … and a reactive-forms `FormGroup`) is unchanged and still
exported. It works with both query clients but grew up alongside the
[legacy client](/query/legacy). Prefer `defineQueryForm` for new code - it binds
to `@ethlete/components` controls directly and is signals-native throughout.

::: warning Superseded by `defineQueryForm`
The class remains for apps on classic reactive forms; everything else should use
the signals-first form documented above. The concepts map one to one:

| Legacy                                                                                                                                                                  | Current                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `new QueryForm({ … })`                                                                                                                                                  | [`defineQueryForm({ fields })`](#quickstart)                                                             |
| `QueryField`, `SearchQueryField`, `SortQueryField`, `StringArrayQueryField`, `NumberArrayQueryField`, `BooleanArrayQueryField`, `DateQueryField`, `DateArrayQueryField` | the lowercase [field creators](#field-creators) of the same names (`queryField`, `searchQueryField`, …)  |
| `form` (a `FormGroup`) + `controls`, bound with `[formControl]`                                                                                                         | `fields`, bound with `[formField]` - any signal-forms control, including every `@ethlete/components` one |
| `changes$` / `currentValue$` / `previousValue$` / `activeFilterCount$`                                                                                                  | the `changes`, `value`, `previousValue` and `activeFilterCount` signals                                  |
| `defaultFormValue`                                                                                                                                                      | `defaultValue`                                                                                           |
| Cloning the `FormGroup` for a filter overlay draft                                                                                                                      | [`branch()`](#filter-overlays)                                                                           |

`observe()` / `unobserve()`, the per-field options and the URL serialization rules
are the same on both. For the filter panel this used to sit behind, see
[filter overlay](/components/filter-overlay) in `@ethlete/components`.
:::
