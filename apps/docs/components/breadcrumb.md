# Breadcrumb

The trail that says where in the app the user is. Each crumb is a template you declare, so a crumb can
be a router link, the plain text of the current page, or a placeholder while its name is still being
fetched — and when the trail runs out of room, the middle crumbs move into a popover instead of being
clipped.

```ts
import { BREADCRUMB_IMPORTS } from '@ethlete/components';
```

```html
<et-breadcrumb>
  <ng-template etBreadcrumbItemTemplate>
    <a etBreadcrumbItem routerLink="/teams">Teams</a>
  </ng-template>
  <ng-template [loading]="team.isLoading()" etBreadcrumbItemTemplate>
    <span etBreadcrumbItem>{{ team.name() }}</span>
  </ng-template>
</et-breadcrumb>
```

## Live demo

<StoryEmbed id="components-breadcrumb--default" height="320px" />

## Anatomy

| Piece                      | What it is                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `et-breadcrumb`            | The navigation landmark: an `<ol>` of crumbs with separators, and the overflow control once they stop fitting.              |
| `etBreadcrumbItemTemplate` | One crumb, as an `<ng-template>` — the breadcrumb decides whether it renders inline or inside the overflow.                 |
| `etBreadcrumbItem`         | The crumb element itself (`<a>`, `<button>`, `<span>`): default styling plus `aria-current` on the last crumb.              |
| `etBreadcrumbSeparator`    | Optional `<ng-template>` replacing the chevron between crumbs.                                                              |
| `etBreadcrumbTemplate`     | Registers a routed page's whole trail, for rendering elsewhere — see [Trails from routed pages](#trails-from-routed-pages). |
| `et-breadcrumb-outlet`     | Renders whichever page's trail is currently registered.                                                                     |

### Why templates instead of elements

A crumb has to be renderable in two places — inline in the trail, or inside the overflow popover — and
only a template can be. It is also what lets a page own a crumb whose label it doesn't have yet: mark
the template `loading` and the crumb keeps its slot until the name arrives.

### Inputs

| Input      | Default | Description                                                                                                 |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `collapse` | `true`  | Move the middle crumbs into the overflow control when the trail doesn't fit. Off leaves your CSS in charge. |
| `labels`   | `null`  | Per-instance overrides for the accessible labels, merged over the provided `BREADCRUMB_LABELS`.             |

`etBreadcrumbItemTemplate` takes `loading` (default `false`).

## Overflow

The breadcrumb measures itself: once the full trail is wider than the space available, everything
between the first crumb and the current page moves into a [toggletip](/components/toggletip) behind an
ellipsis button. The width the full trail needs is remembered from that measurement, so the trail
expands again only when there is genuinely room for all of it — it never flickers between the two
states as the container resizes.

If even the collapsed trail is too wide (a long title on a phone), the current page truncates with an
ellipsis rather than being clipped mid-word.

<StoryEmbed id="components-breadcrumb--collapsed" height="320px" />

## Trails from routed pages

The trail usually belongs in the app shell, but only the routed page knows what it says. Provide the
manager once above both, let each page register its trail, and render it in the shell:

```ts
// app.config.ts
providers: [provideBreadcrumbManager()];
```

```html
<!-- shell -->
<et-breadcrumb-outlet />
```

```html
<!-- routed page -->
<ng-template etBreadcrumbTemplate>
  <et-breadcrumb>
    <ng-template etBreadcrumbItemTemplate>
      <a etBreadcrumbItem routerLink="/teams">Teams</a>
    </ng-template>
    <ng-template [loading]="isLoading()" etBreadcrumbItemTemplate>
      <span etBreadcrumbItem>{{ team().name }}</span>
    </ng-template>
  </et-breadcrumb>
</ng-template>
```

The outlet renders nothing when no page has registered a trail, so the shell doesn't need to know which
routes have breadcrumbs. A page's trail is dropped when the page is destroyed — unless the next page has
already registered its own, which is what keeps the outlet from blanking during a route change.

Crumbs are deliberately **not** derived from the route config: half of them are usually named after data
the page just loaded, which a static config can't know.

<StoryEmbed id="components-breadcrumb--routed-outlet" height="360px" />

## Localization

Two accessible labels, both localizable app-wide or per instance:

```ts
provideBreadcrumbLabels({ navigation: 'Brotkrumen', overflow: 'Ausgeblendete Ebenen anzeigen' });
```

| Label        | Default                | Applies to                                       |
| ------------ | ---------------------- | ------------------------------------------------ |
| `navigation` | `'Breadcrumb'`         | the navigation landmark's `aria-label`           |
| `overflow`   | `'Show hidden levels'` | the ellipsis button that opens the hidden crumbs |

## Accessibility

- The host is the landmark: `role="navigation"` with the `navigation` label, wrapping an `<ol>` of
  `<li>` crumbs — so a screen reader announces the trail as an ordered list of a known length.
- The last crumb gets `aria-current="page"`, which is how the current position is conveyed. Leave it as
  plain text rather than a link.
- Separators are `aria-hidden` and live inside the preceding `<li>`, so they never count as list items.
- The overflow control is a real button with an accessible label, `aria-expanded` and `aria-controls`;
  it opens a toggletip, moves focus into it, and returns focus to the button on <kbd>Escape</kbd> or
  outside click. The hidden crumbs stay a plain list of links inside it — deliberately not a
  `role="menu"`, which may only contain menu items.
- A `loading` crumb renders a [skeleton](/components/skeleton), which announces the wait via
  `role="status"`.

## Theming

Colours come from the app-registered [surface and color themes](/core/theming): crumbs are muted, the
current page takes the full-strength text colour, and the focus ring uses
`--et-theme-color-primary-solid`. Geometry is tokens:

| Property                         | Default | Applies to                               |
| -------------------------------- | ------- | ---------------------------------------- |
| `--et-breadcrumb-gap`            | `6px`   | gap between crumbs and their separators  |
| `--et-breadcrumb-separator-size` | `12px`  | the chevron box                          |
| `--et-breadcrumb-loading-width`  | `72px`  | width of a `loading` crumb's placeholder |

## Error codes

The breadcrumb throws `ET37xx` in dev mode when its parts are misplaced — see
[error codes](/components/error-codes#breadcrumb-et37xx).
