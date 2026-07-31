# Breadcrumb

The trail that says where in the app the user is. Each crumb is a template you declare, so a crumb can
be a router link, the plain text of the current page, or a placeholder while its name is still being
fetched — and when the trail runs out of room, the middle crumbs move into a popover instead of being
clipped.

In a routed app you don't build the whole trail anywhere: every view contributes **only the crumbs it
owns** and the shell's outlet composes them — see [Trails from routed views](#trails-from-routed-views).

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

| Piece                      | What it is                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `et-breadcrumb`            | The navigation landmark: an `<ol>` of crumbs with separators, and the overflow control once they stop fitting. |
| `etBreadcrumbItemTemplate` | One crumb, as an `<ng-template>` — the breadcrumb decides whether it renders inline or inside the overflow.    |
| `etBreadcrumbItem`         | The crumb element itself (`<a>`, `<button>`, `<span>`): default styling plus `aria-current` on the last crumb. |
| `etBreadcrumbSeparator`    | Optional `<ng-template>` replacing the chevron between crumbs.                                                 |
| `etBreadcrumbSegment`      | One view's contribution to the trail — the crumbs it owns, nothing above it.                                   |
| `et-breadcrumb-outlet`     | Renders the trail composed from every segment currently on screen.                                             |

### Why templates instead of elements

A crumb has to be renderable somewhere its declaring view doesn't control — inline in the trail, inside
the overflow popover, or in a shell outlet several routes above — and only a template can be. It is also
what lets a view own a crumb whose label it doesn't have yet: mark the template `loading` and the crumb
keeps its slot until the name arrives.

### Inputs

| Input      | Default | Description                                                                                                 |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `collapse` | `true`  | Move the middle crumbs into the overflow control when the trail doesn't fit. Off leaves your CSS in charge. |
| `labels`   | `null`  | Per-instance overrides for the accessible labels, merged over the provided `BREADCRUMB_LABELS`.             |

`etBreadcrumbItemTemplate` takes `loading` (default `false`) plus `name`/`url` for
[structured data](#seo-structured-data); `etBreadcrumbSegment` takes `order` (default `null`);
`et-breadcrumb-outlet` takes `collapse` and `labels` and forwards them.

## Overflow

The breadcrumb measures itself: once the full trail is wider than the space available, everything
between the first crumb and the current page moves into a [toggletip](/components/toggletip) behind an
ellipsis button. The width the full trail needs is remembered from that measurement, so the trail
expands again only when there is genuinely room for all of it — it never flickers between the two
states as the container resizes.

If even the collapsed trail is too wide (a long title on a phone), the current page truncates with an
ellipsis rather than being clipped mid-word.

The first measurement happens before the browser paints, so a trail that loads collapsed is painted
collapsed — you never see the full trail flash and then be replaced. Until that measurement exists the
trail holds its space without painting, which is what removes the flash if it can't be taken in time
(the element isn't laid out yet, for instance). Nothing to do for it; it only applies while `collapse`
is on and there are enough crumbs to collapse.

<StoryEmbed id="components-breadcrumb--collapsed" height="320px" />

## Trails from routed views

The trail belongs in the app shell, but no single view knows all of it: the deep pages are named after
data they just loaded. So each view registers **only its own crumbs** and the outlet renders all the
registered segments as one trail, in view order — a detail page contributes one crumb and never restates
the path above it.

```ts
// app.config.ts — one manager above the outlet and every view that contributes
providers: [provideBreadcrumbManager()];
```

```html
<!-- shell: one outlet, plus (optionally) the root crumb -->
<et-breadcrumb-outlet />

<ng-template etBreadcrumbSegment>
  <ng-template etBreadcrumbItemTemplate>
    <a etBreadcrumbItem routerLink="/">Home</a>
  </ng-template>
</ng-template>

<router-outlet />
```

```html
<!-- teams-list-view.component.ts — the level's own crumb, then its children -->
<ng-template etBreadcrumbSegment>
  <ng-template etBreadcrumbItemTemplate>
    <a etBreadcrumbItem routerLink="/teams">Teams</a>
  </ng-template>
</ng-template>
```

```html
<!-- team-detail-view.component.ts — one crumb, the part only this view knows -->
<ng-template etBreadcrumbSegment>
  <ng-template [loading]="team.isLoading()" etBreadcrumbItemTemplate>
    <a [routerLink]="['/teams', team.id()]" etBreadcrumbItem>{{ team.name() }}</a>
  </ng-template>
</ng-template>
```

The outlet renders nothing while no view has contributed a crumb, so the shell needs to know nothing
about which routes have breadcrumbs. When a view is destroyed only _its_ crumbs disappear, which is why
navigating from `/teams/chemie/squad` back to `/teams/chemie` drops one crumb instead of rebuilding the
trail.

Crumbs are deliberately **not** derived from the route config: half of them are named after data the
view just loaded, which a static config can't know.

### The routing hierarchy this needs

Segments compose along the **router hierarchy**, so the routes have to nest the way the trail does. Each
level that adds a crumb needs a routed view of its own, holding its segment and a `<router-outlet>` for
the level below:

```ts
export const TEAM_ROUTES: Routes = [
  {
    // contributes "Teams", renders the level below
    path: 'teams',
    loadComponent: () => import('./teams-view/teams-view.component').then((m) => m.TeamsViewComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./teams-list-view/teams-list-view.component').then((m) => m.TeamsListViewComponent),
      },
      {
        // contributes the team's name, renders the level below
        path: ':teamId',
        loadComponent: () => import('./team-view/team-view.component').then((m) => m.TeamViewComponent),
        children: [
          {
            path: 'squad',
            loadComponent: () =>
              import('./team-squad-view/team-squad-view.component').then((m) => m.TeamSquadViewComponent),
          },
        ],
      },
    ],
  },
];
```

That is the structure the styleguide's routing rules already push you towards: routed components live in
a `*-view/` folder and are named `*ViewComponent` (enforced for every `loadComponent`), so "the view that
owns this level of the URL" is already a file that exists. Its segment is one `<ng-template>` in it.

A view that adds no level simply declares no segment. A view that owns a level but renders no crumb of
its own (a pure layout) is fine too — it just contributes an empty segment, or none at all.

### Order, and the one rule to follow

Segments appear in the trail in **registration order**, which under the router is view-creation order:
outermost route first. Two consequences:

- **Declare the segment unconditionally.** A segment behind an `@if` that flips later registers _after_
  its own children and would land at the wrong position. When the label isn't there yet, keep the
  segment and mark the crumb `loading` — that is what the placeholder is for.
- **Sibling order inside one view** is declaration order, so a view contributing two crumbs gets them in
  the order they appear in its template.

For a structure whose creation order genuinely doesn't match its hierarchy, `etBreadcrumbSegment` takes
an explicit `order` (a number; segments without one keep their registration index, and the two are
compared on the same scale, so `order="0"` pins a segment to the front).

### Configuring the composed breadcrumb

The outlet forwards `collapse` and `labels` to the breadcrumb it renders, and anything you project into
it lands inside — which is how a shell-wide separator is set:

```html
<et-breadcrumb-outlet [collapse]="true">
  <ng-template etBreadcrumbSeparator>/</ng-template>
</et-breadcrumb-outlet>
```

<StoryEmbed id="components-breadcrumb--routed-outlet" height="360px" />

## SEO: structured data

A breadcrumb is one of the few components with a direct search-result payoff: `schema.org`'s
**BreadcrumbList** is what turns a bare URL in a result into a readable trail. Import
`BREADCRUMB_SEO_IMPORTS` and add `etBreadcrumbSeo`:

```html
<et-breadcrumb etBreadcrumbSeo>
  <ng-template etBreadcrumbItemTemplate name="Home" url="https://example.com/">
    <a etBreadcrumbItem routerLink="/">Home</a>
  </ng-template>
  <ng-template etBreadcrumbItemTemplate name="Teams" url="https://example.com/teams">
    <a etBreadcrumbItem routerLink="/teams">Teams</a>
  </ng-template>
  <!-- the current page: named, but with no url -->
  <ng-template [name]="team.name()" etBreadcrumbItemTemplate>
    <span etBreadcrumbItem>{{ team.name() }}</span>
  </ng-template>
</et-breadcrumb>
```

<StoryEmbed id="components-breadcrumb--structured-data" height="420px" />

**The crumbs state their `name` and `url`; nothing is scraped from the DOM.** A crumb's content is a
template — it may be an icon, a chip, or markup with no single text form — and its `routerLink` is a
path, where `schema.org` asks for an absolute URL. Only the app knows both.

The rules it applies:

- **Crumbs still `loading` are skipped**, and so are crumbs with no `name`. A `BreadcrumbList` with a
  placeholder in it is worse than a shorter one; positions are renumbered so the list stays `1..n`.
- **The last crumb needs no `url`** — it is the page the markup sits on, which is what Google's
  breadcrumb guidance asks for.
- **Collapsing doesn't change it.** The markup describes `items()`, not what currently fits on
  screen: whether the middle crumbs are behind the overflow control is a layout decision.
- **Fewer than two named crumbs emits nothing.** A one-item trail tells a crawler nothing it can't
  already see.

It works the same on `<et-breadcrumb-outlet>`, where the trail is composed from routed segments — put
the attribute on the outlet and each segment's crumbs supply their own `name`/`url`.

`[etBreadcrumbSeo]="false"` turns it off without removing the directive, for a page that shouldn't
publish a trail. It ships separately from the breadcrumb so an app doing no head management never
pulls core's structured-data store into its bundle — the same split as
[`etPaginationSeo`](/components/pagination#links-mode-seo).

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
`--et-theme-color-primary-solid`. A trail is chrome, so the accent colour appears in nothing else — the
overflow button stays neutral even while its popover is open, and hover states are the neutral
`--et-surface-interaction-solid` tint. Geometry is tokens:

| Property                         | Default | Applies to                                           |
| -------------------------------- | ------- | ---------------------------------------------------- |
| `--et-breadcrumb-gap`            | `6px`   | gap between crumbs and their separators              |
| `--et-breadcrumb-separator-size` | `12px`  | the chevron box                                      |
| `--et-breadcrumb-radius`         | `6px`   | rounding of the overflow button and its popover rows |
| `--et-breadcrumb-loading-width`  | `72px`  | width of a `loading` crumb's placeholder             |

The overflow button renders the built-in `et-ellipsis` icon, so
[`provideIconOverrides`](/components/icon#overriding-the-built-in-icons) can swap the glyph.

## Error codes

The breadcrumb throws `ET37xx` in dev mode when its parts are misplaced — see
[error codes](/components/error-codes#breadcrumb-et37xx).
