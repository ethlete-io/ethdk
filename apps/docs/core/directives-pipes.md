# Directives & pipes

Small standalone directives and pipes that don't belong to a larger system.

## Click outside

`ClickOutsideDirective` (`[etClickOutside]`) emits when a click lands outside the host element:

```html
<div (etClickOutside)="close()" etClickOutside>…</div>
```

## Repeat

`*etRepeat` renders its template N times (default `2`) — for skeletons and placeholder rows:

```html
<et-skeleton-row *etRepeat="5" />
```

## Scroll observer

`ScrollObserverDirective` (`[etScrollObserver]`, exportAs `etScrollObserver`) reports whether sentinel children are inside the host's scroll viewport — the classic "show a shadow while not at the edge" primitive:

```html
<div #observer="etScrollObserver" etScrollObserver>
  <div etScrollObserverStart></div>
  <ng-content />
  <div etScrollObserverEnd></div>
</div>
```

Place `etScrollObserverStart` / `etScrollObserverEnd` sentinels as first/last children; the directive exposes `isAtStart` and `isAtEnd` signals (both default `false`). The `enabled` model input (default `true`) accepts a boolean or a signal.

## Pipes

| Pipe             | Signature                 | Description                                                                                                         |
| ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `markdownToHtml` | `string → string`         | Dependency-free Markdown → HTML (headings, emphasis, code blocks, links, images, lists, GFM tables, blockquotes).   |
| `htmlToMarkdown` | `string → string`         | The reverse conversion.                                                                                             |
| `inferMimeType`  | `string → string \| null` | Infers a MIME type from a URL or srcset — handles `data:` URIs, Contentful `?fm=` params and a large extension map. |
| `toArray`        | `number → number[]`       | `3` → `[0, 1, 2]`, for index-based iteration.                                                                       |

The conversion logic behind `markdownToHtml` / `htmlToMarkdown` and `inferMimeType` is also exported as plain functions — see [Utilities](/core/utilities).

### Match normalization pipes

A set of sport-domain pipes (`etNormalizeMatchState`, `etNormalizeMatchScore`, `etNormalizeMatchParticipants`, `etNormalizeMatchType`, `etNormalizeGameResultType`) that normalize `@ethlete/types` match views into render-ready view models with `Translatable` labels (`{ i18n, text }` — a translation key plus English fallback). Only relevant for apps rendering Ethlete match data.
