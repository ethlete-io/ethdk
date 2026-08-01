# Query error

The default rendering of a failed [query](/query/errors): a heading from the status, the message (or the
violation list), and a retry button when the failure is one worth repeating.

Import `QUERY_ERROR_IMPORTS`. Your app must register a color theme with `type: 'error'` — that is what the panel
paints itself with (see [theming](/core/theming)).

```html
@if (usersQuery.error(); as error) {
<et-query-error [error]="error" [query]="usersQuery" />
}
```

Render it conditionally, as above. That is not just tidiness: the element carries `role="alert"`, and an alert
announces when it _appears_, so a reader who has moved on from the button they pressed still learns it failed.

## Live demo

<StoryEmbed id="components-query-error--default" height="320px" />

## It classifies nothing

Worth knowing, because it shapes the API. `@ethlete/query` already normalizes every error shape it recognises —
class-validator arrays, Symfony violation lists, a bare `{ message }`, a plain string, a dev-mode `{ detail }` —
into a single `QueryErrorResponse` before it reaches `query.error()`, and it attaches the retry policy's verdict
as `retryState`. This component reads that.

`@ethlete/cdk`'s version re-did all of it by hand against the legacy client's types, which is why it could only
ever be used with a legacy query. This one names no client's types at all.

<StoryEmbed id="components-query-error--violation-list" height="340px" />

## What the reader actually sees

The title always comes from the HTTP status, because that is the one thing every failure has. The message is the
response's own — except in two cases where the status table's sentence is better:

- **The message repeats the title.** Plenty of APIs answer `404` with `"Not found"`, and rendering that under the
  heading "Not found" says nothing twice.
- **The response carried no message.** The query client then falls back to Angular's
  `HttpErrorResponse.message` — `"Http failure response for /api/teams/42: 500 Error"` — which is developer text
  and must never reach a reader.

Titles and fallback messages come from `@ethlete/query`'s English status tables by default. A German table
ships too, but as an opt-in — referencing it would otherwise put both languages in every bundle:

```ts
// German whenever injectLocale() reports a German locale, English otherwise:
provideQueryErrorLabels(queryErrorLabelsForLocale);
// or German unconditionally:
provideQueryErrorLabels(GERMAN_QUERY_ERROR_LABELS);
```

cdk took a `language: 'en' | 'de'` input; locale belongs to the app's context, not to each error's markup.

## Retrying

The retry button appears only when the retry policy says the failure is worth repeating — a `503` yes, a `404`
no, since offering to try again on something that cannot resolve itself wastes the reader's time. Two escape
hatches:

- **`alwaysAllowRetry`** shows the button regardless, for a query whose failure really can be transient in a way
  the policy can't see.
- **`retryRequest`** fires on every retry, with or without a `query` bound — the hook for a recovery that isn't
  a re-execution.

`[query]` takes anything with an `execute` method, and the retry **bypasses the cache**: a retry exists because
the last answer was unusable, so serving it again from memory would make the button do nothing.

<StoryEmbed id="components-query-error--retryable" height="320px" />

## Customizing the wording

Three levels, smallest first:

**Labels** — for the strings themselves. `provideQueryErrorLabels` app-wide, or the `labels` input per instance.
Partial: what you leave out keeps the English default, which is also how you localize into another language.

```ts
provideQueryErrorLabels({
  retry: 'Réessayer',
  title: (status) => (status === 403 ? 'Accès refusé' : 'Une erreur est survenue'),
});
```

**Slots** — for markup. `etQueryErrorTitle` and `etQueryErrorActions` replace the heading and the whole actions
row; the error is in scope in both, so the wording can key off the status.

```html
<et-query-error #err="etQueryError" [error]="error" [query]="usersQuery">
  <ng-template etQueryErrorTitle let-error>
    {{ error.status === 401 ? 'You are signed out' : error.title }}
  </ng-template>

  <ng-template etQueryErrorActions>
    <button (click)="err.retry()" et-button>Try again</button>
    <a routerLink="/support">Contact support</a>
  </ng-template>
</et-query-error>
```

**The headless directive** — for a layout of your own. `[etQueryError]` holds all the state and none of the
markup:

```html
<div #err="etQueryError" [error]="error" [query]="usersQuery" etQueryError>
  <h4>{{ err.view()?.title }}</h4>
  @for (message of err.view()?.messages ?? []; track message) {
  <p>{{ message }}</p>
  } @if (err.canRetry()) {
  <button (click)="err.retry()">Retry</button>
  }
</div>
```

## Legacy queries

An app still on the [legacy V2 client](/query/legacy) gets the same UI through a thin adapter, so the component
itself stays free of legacy types:

```ts
private usersError = legacyQueryErrorSource({
  error: toSignal(this.usersQuery.state$.pipe(map((s) => (isQueryStateFailure(s) ? s.error : null)))),
  query: () => this.usersQuery,
});
```

```html
@if (usersError.error(); as error) {
<et-query-error [error]="error" [query]="usersError.retryTarget" />
}
```

The conversion is nearly free — a legacy `RequestError` carries the raw `HttpErrorResponse` it came from, so the
current client's own normalizer does the classifying and the same retry policy judges it. `queryErrorResponseFromLegacyError`
is exported on its own if you only need the shape conversion.

The error is passed in rather than read off the query because legacy query state is an `Observable`, not a
signal — how you get from `state$` to a signal is your app's choice, not this adapter's.

## Options

### `[etQueryError]` (and `<et-query-error>`, which forwards all of them)

| Input              | Type                                        | Default | Purpose                                                      |
| ------------------ | ------------------------------------------- | ------- | ------------------------------------------------------------ |
| `error`            | `QueryErrorResponse \| null` (**required**) | —       | The failed query's error. `null` renders nothing.            |
| `query`            | `QueryErrorRetryTarget \| null`             | `null`  | What to re-execute on retry — anything with `execute`.       |
| `alwaysAllowRetry` | `boolean`                                   | `false` | Offer a retry even for a failure the policy considers final. |
| `labels`           | `Partial<QueryErrorLabels> \| null`         | `null`  | Per-instance string overrides.                               |

| Member             | Type                             | Purpose                                                        |
| ------------------ | -------------------------------- | -------------------------------------------------------------- |
| `view()`           | `Signal<QueryErrorView \| null>` | Title, messages, `isList`, `canRetry`, `retryDelay`, `status`. |
| `canRetry()`       | `Signal<boolean>`                | Whether to offer a retry.                                      |
| `resolvedLabels()` | `Signal<QueryErrorLabels>`       | The strings in effect after locale + overrides.                |
| `retry()`          | `() => void`                     | Re-execute (cache bypassed) and emit `retryRequest`.           |
| `retryRequest`     | `output<void>`                   | The reader asked to retry.                                     |

`<et-query-error>` adds one input of its own: **`color`** (`RegisteredColorThemeName | ColorTheme | null`),
defaulting to the app's `type: 'error'` theme.

## Accessibility

The host is `role="alert"`, so an error that appears is announced — assertive rather than polite on purpose: the
request the reader asked for did not happen. This only works if the element is created when the error is, hence
the `@if` around it.

The status icon is `aria-hidden` (it duplicates the title), and a violation list is a real `<ul>`, so a screen
reader announces how many problems there are before reading them.

## Theming

There is no global "error color" variable in this system — error is a _theme_, which is why the component takes
it from DI via `injectErrorTheme()` and provides it as a color scope on its own host. Inside that scope
`--et-theme-color-primary-*` **is** the error color, so the panel's tint, border and icon all follow whatever the
app registered, and the retry button inherits it without being told.

| Token                            | Default | Purpose                     |
| -------------------------------- | ------- | --------------------------- |
| `--et-query-error-gap`           | `8px`   | Space between the parts.    |
| `--et-query-error-padding`       | `20px`  | Panel padding.              |
| `--et-query-error-border-radius` | `12px`  | Panel corner radius.        |
| `--et-query-error-icon-size`     | `24px`  | The status icon.            |
| `--et-query-error-title-size`    | `16px`  | Title font size.            |
| `--et-query-error-title-weight`  | `600`   | Title font weight.          |
| `--et-query-error-message-size`  | `14px`  | Message and list font size. |

Text colors come from the surface tokens, so the panel reads correctly on any elevation.

## Error codes

Query error throws in the `ET40xx` range — see [error codes](/components/error-codes#query-error-et40xx).
