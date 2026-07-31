# SEO

Signal-based head management: a family of `apply*Binding` functions that write the document title, meta tags, links and JSON-LD structured data — all SSR-safe (they go through Angular's `Title`/`Meta` services and the renderer, never raw `document` calls).

Every binding accepts a raw value **or a signal** (`MaybeSignal<T>`) and must be called in an injection context — typically a component constructor or field initializer. Bindings clean up after themselves when the component is destroyed:

```ts
import { applyDescriptionBinding, applyHeadTitleBinding } from '@ethlete/core';

@Component({/* … */})
export class HomeComponent {
  constructor() {
    applyHeadTitleBinding('Home');
    applyDescriptionBinding('This is the home page.');
  }
}
```

## Title

`applyHeadTitleBinding(text, options?)` adds a title part; the store composes all active parts into the document title. Configure composition app-wide:

```ts
// app.config.ts
provideTitleConfig({ suffixPart: { text: 'Ethlete SDK' } }),
```

| `TitleConfig` option        | Default  | Description                                                                   |
| --------------------------- | -------- | ----------------------------------------------------------------------------- |
| `divider`                   | `'\|'`   | Joins the title parts.                                                        |
| `defaultTitle`              | `''`     | Fallback when no parts are active (falls back to the initial document title). |
| `transformer`               | identity | Runs over the final title, e.g. for translation.                              |
| `prefixPart` / `suffixPart` | —        | Static parts around the composed title.                                       |

Pass `{ useAsStart: true }` to make a part the leftmost segment, discarding parts registered before it.

### Title markers {#title-markers}

`applyHeadTitleMarker(binding)` prefixes a short marker onto the composed title while the binding has a value — the unsaved-changes dot, a pending count, and the like. Markers sit **outside** the divider logic (`● Editor | Ethlete SDK`, not `● | Editor | …`), identical markers are deduplicated, and a marker is removed when the binding goes empty or the injector is destroyed.

```ts
applyHeadTitleMarker(computed(() => (this.hasUnsavedWork() ? '●' : null)));
```

The [unsaved-changes tab guard](/core/utilities#unsaved-changes-tab) uses the same mechanism via its `titleMarker` option, so the marker only works in apps whose title is owned by this store.

## Favicon overlays {#favicon}

`applyFaviconOverlay(binding)` draws on top of the site's favicon while the binding has a value, and restores the original icon when it goes empty (or the injector is destroyed):

```ts
// a dot in the corner — "something is unsaved / unread here"
applyFaviconOverlay(computed(() => (this.hasUnsavedWork() ? { kind: 'dot' } : null)));

// a ring around the icon, 0–100
applyFaviconOverlay(computed(() => (this.saving() ? { kind: 'progress', value: this.percent() } : null)));
```

| Overlay      | Fields                                   | Notes                                                             |
| ------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| `'dot'`      | `color?`                                 | Badge punched into the bottom-right corner.                       |
| `'progress'` | `value` (0–100), `color?`, `trackColor?` | Ring around the icon. Wins over a `dot` when both are registered. |

`color` defaults to `--et-theme-color-primary-solid`, read off the root element at draw time, so the overlay follows the app's [color theme](/core/theming).

This is the only real answer to "show progress on the tab": no browser exposes taskbar or tab progress. Notes:

- The base icon is read from `<link rel="icon">` and drawn onto a 64×64 canvas. A **cross-origin** icon without CORS headers taints the canvas — the favicon is then left untouched rather than broken. An icon the browser can't decode is skipped and the overlay draws on an empty canvas.
- If the page has no icon link at all, one is created and removed again on restore.
- SSR-safe: nothing is drawn on the server.

## Meta tags

`applyMetaBinding(config)` is the generic form; shortcuts exist for the common cases:

| Function                   | Writes                                                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applyDescriptionBinding`  | `name="description"`                                                                                                                                       |
| `applyKeywordsBinding`     | `name="keywords"` from a `string[]`                                                                                                                        |
| `applyAuthorBinding`       | `name="author"`                                                                                                                                            |
| `applyRobotsBinding`       | `name="robots"` from a `RobotsConfig` (`index`, `follow`, `maxSnippet`, …)                                                                                 |
| `applyOpenGraphBindings`   | The full `og:*` family (title, description, images, videos, …)                                                                                             |
| `applyTwitterCardBindings` | `twitter:*` (card, site, creator, images, player, …)                                                                                                       |
| `applyArticleBindings`     | `article:*` (published_time, authors, tags, …)                                                                                                             |
| `applySocialMediaBindings` | The convenience wrapper: from `title`/`description`/`image`/`url` it fans out to title, description, Open Graph **and** Twitter — the usual one-stop call. |

Duplicate tags are deduplicated by selector with the highest-priority binding winning, except for multi-instance tags (`og:image`, `twitter:image`, `article:tag`, …) which all render. Extend the set via `provideMetaConfig({ multiInstanceTags })`.

## Links

| Function                                                    | Writes                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `applyLinkBinding`                                          | Any `<link>` from a `LinkConfig`.                                                                   |
| `applyCanonicalBinding`                                     | `rel="canonical"`                                                                                   |
| `applyAlternateBinding` / `applyAlternateLanguagesBindings` | `rel="alternate"` with `hreflang` — the plural form takes `{ en: url, de: url, 'x-default': url }`. |
| `applyPrevBinding` / `applyNextBinding`                     | `rel="prev"` / `rel="next"` pagination links.                                                       |
| `applyResourceHintsBindings`                                | `preconnect` / `dns-prefetch` / `prefetch` / `prerender` from arrays of URLs.                       |

## Structured data (JSON-LD)

`applyStructuredDataBinding(data)` injects a `<script type="application/ld+json">` element and removes it on destroy. The schema.org shapes ship as types under the `JsonLD` namespace:

```ts
import { JsonLD, applyStructuredDataBinding } from '@ethlete/core';

applyStructuredDataBinding({
  '@context': 'https://schema.org',
  '@type': 'SportsEvent',
  name: 'Grand Final',
} satisfies JsonLD.WithContext<JsonLD.SportsEvent>);
```

By default the script lands in `<body>` (Google's recommendation); switch with `provideStructuredDataConfig({ placement: 'head' })`. Alternatively, render it directly in a template with `<et-structured-data [data]="…" />`.

## Locale awareness

All title and meta content runs through the configured transformers and re-applies when the [locale](/core/providers#locale) signal changes — so translated titles update in place.

`transformer(text, locale)` is deliberately a different mechanism from the UI library's [label tokens](/components/localization): the strings here are **yours** (route titles, meta content), so there is no default wording to override — each one is handed to your translator instead. Label tokens exist for the opposite case, where the SDK wrote the string.

::: warning Deprecated: `SeoDirective`
The old Observable-based `SeoDirective` (and its `SeoConfig` types) is deprecated and not SSR-safe. Use the binding functions above instead.
:::
