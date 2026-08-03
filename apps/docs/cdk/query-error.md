# Query error & query button

Two pieces that surface [`@ethlete/query`](/query/) state in the UI: a component that renders a query's failure human-readable, and a button that mirrors a query's lifecycle.

::: warning Superseded by @ethlete/components

- **`et-query-error`** → the [components query error](/components/query-error) (`QUERY_ERROR_IMPORTS`).
  Same two inputs, but it classifies nothing itself: `@ethlete/query` already normalizes every error shape
  before it reaches `query.error()`, so the successor works with the current client instead of only the
  legacy one. The `language` input is gone - strings come from `injectLocale()` and label providers - and
  your app must register a color theme with `type: 'error'` for the panel to paint itself.
- **`[et-query-button]`** has no direct successor. Bind the query's state to the
  [button](/components/button)'s `loading` input instead
  (`<button [loading]="!!save.loading()" et-button>`), which gives you the spinner, the inactive state and
  `aria-busy` - without the one-second success/failure flash.

This page documents the CDK versions, which still receive bug fixes.
:::

## Query error

`et-query-error` takes a query and/or its error and renders a title, the parsed error message(s) and - when the error is retryable - a retry button that re-executes the query with `skipCache`:

```html
<et-query-error [error]="query.error()" [query]="query" language="de" />
```

```ts
import { QueryErrorComponent } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-query-error--retryable-error" height="220px" />

| Input              | Default | Purpose                                                                                          |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| `error` (required) | -       | The `RequestError` to render (`null` renders nothing).                                           |
| `query` (required) | -       | The query - used for the retry action. Accepts v2 queries, legacy queries and query collections. |
| `language`         | `'en'`  | Message language: `'en'` or `'de'`.                                                              |

The error `detail` is parsed into a message list with support for common backend shapes - class-validator errors, Symfony violation lists and list errors, plain `{ message }` / `{ detail }` objects and raw strings - falling back to a generic message derived from the HTTP status. Multiple messages render as a list.

The parsing lives in the headless `QueryErrorDirective` (same inputs, exposes the parsed `errorList`) - use it directly for custom markup. The default markup exposes `et-query-error-title`, `et-query-error-message` / `et-query-error-list` and `et-query-error-retry-button` classes for styling.

## Query button

`[et-query-button]` extends the CDK button (`disabled`, `type`, `pressed` all work): bind a query and the button reflects its lifecycle automatically.

```html
<button [query]="savePost$ | async" (click)="save()" et-query-button>Save</button>
```

```ts
import { QueryButtonComponent } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-buttons-query-button--default" height="160px" />

While the query runs, the button gets `et-query-button--loading` and shows its loading template; on completion it flips to `--success` or `--failure` for about a second before resetting. During loading/success/failure the button is disabled and announces the state change via `aria-live`, preventing double submits without manual wiring. Each phase can be opted out with `skipLoading`, `skipSuccess` and `skipFailure` (all default `false`).

If the bound query is already settled when the button binds, that state is skipped - the button won't flash success for something that happened earlier.
