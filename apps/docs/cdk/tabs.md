# Tabs

Two flavors that share a tab bar: **inline tabs**, which swap projected content in place, and **nav tabs**, where each tab is a router link and the content comes from a `router-outlet`.

::: warning Superseded by @ethlete/components
New code should use the [components tabs](/components/tabs) (`TAB_IMPORTS`, plus `NAV_TAB_IMPORTS` for the
router nav tabs). `et-inline-tabs` → `et-tab-group` and `et-inline-tab` → `et-tab`, with the selection
exposed as a two-way model instead of `selectedIndex` + three outputs. `[et-inline-tab-label]` →
`[etTabLabel]`, `[etInlineTabContent]` → `[etTabPanel]`. The header becomes `TabBarDirective` - a directive
with variants, sizes and orientations that scrolls with the [scrollable](/components/scrollable) instead of
paginating, so the `itemSize` / `renderMasks` / `renderButtons` / `renderScrollbars` passthroughs and the
whole `PaginatedTabHeaderDirective` are gone. `ActiveTabUnderlineDirective` → `TabBarUnderlineDirective`,
and the panel renders its content directly (no `InlineTabBodyComponent`). The nav-tab trio keeps its names
and gains headless variants (`[etNavTabs]`, `[etNavTabLink]`, `[etNavTabsOutlet]`). This page documents the
CDK version, which still receives bug fixes.
:::

```ts
import { TabImports } from '@ethlete/cdk';
```

## Inline tabs

Each `et-inline-tab` carries its own label and content; the group renders the bar and swaps the panel:

```html
<et-inline-tabs>
  <et-inline-tab label="Tab One">Content 1</et-inline-tab>
  <et-inline-tab label="Other Tab">Content 2</et-inline-tab>
  <et-inline-tab label="Disabled Tab" disabled>Content 3</et-inline-tab>
</et-inline-tabs>
```

<StoryEmbed id="cdk-tabs-inline--default" height="220px" />

### Group options

| Input (on `et-inline-tabs`) | Default        | Purpose                                                                                        |
| --------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `selectedIndex`             | `null`         | Index of the active tab. Clamped to the tab count; `null` selects the first tab.               |
| `contentTabIndex`           | `null`         | `tabindex` for the active panel - set `0` when the panel scrolls or has no focusable children. |
| `preserveContent`           | `false`        | Keep inactive panels in the DOM instead of destroying their content.                           |
| `direction`                 | `'horizontal'` | Bar orientation: `'horizontal'` or `'vertical'`.                                               |
| `tabHeaderClasses`          | -              | `ngClass` value for the tab bar.                                                               |

The bar is a [scrollable](/cdk/scrollable), so it also takes `itemSize` (`'auto' \| 'same'`, default `'auto'`), `renderMasks` (`true`), `renderButtons` (`true`), `renderScrollbars` (`false`) and `scrollableClass`, all forwarded straight through.

| Output                | Payload                | Fires when                                                                |
| --------------------- | ---------------------- | ------------------------------------------------------------------------- |
| `selectedIndexChange` | `number`               | The active index changes.                                                 |
| `selectedTabChange`   | `InlineTabChangeEvent` | Same moment, with `{ index, tab }`. Emits the current value on subscribe. |
| `focusChange`         | `InlineTabChangeEvent` | Keyboard focus moves to another tab header.                               |

### Tab options

| Input (on `et-inline-tab`)       | Default | Purpose                                                                 |
| -------------------------------- | ------- | ----------------------------------------------------------------------- |
| `label`                          | `''`    | Plain-text label (ignored when a label template is provided).           |
| `disabled`                       | `false` | Blocks selection by click and by <kbd>Enter</kbd>/<kbd>Space</kbd>.     |
| `fitUnderlineToContent`          | `false` | Shrink the active underline to the label text instead of the full cell. |
| `labelClass` / `bodyClass`       | -       | `ngClass` values for the header cell and the panel.                     |
| `aria-label` / `aria-labelledby` | -       | Forwarded to the header cell.                                           |

### Custom labels

Replace the plain-text label with a template for icons, badges or counts:

```html
<et-inline-tabs>
  <et-inline-tab>
    <ng-template et-inline-tab-label> <i etIcon="et-chevron"></i> First </ng-template>

    Content 1
  </et-inline-tab>
</et-inline-tabs>
```

<StoryEmbed id="cdk-tabs-inline--with-custom-label" height="220px" />

### Lazy content

Content written directly inside `et-inline-tab` is instantiated with the tab. Wrap it in an `[etInlineTabContent]` template and it is created only when the tab is first selected - the usual choice for panels that fetch data or render something expensive:

```html
<et-inline-tab label="Stats">
  <ng-template etInlineTabContent>
    <expensive-chart />
  </ng-template>
</et-inline-tab>
```

Inactive panels stay in the DOM but are hidden, `inert` and `aria-hidden`; their content is destroyed on deselect unless `preserveContent` is set.

## Nav tabs

The bar is a `<nav>` and every tab is a router link, so the browser URL is the selection state - use this for page-level tabs that should be linkable and reloadable:

```html
<nav et-nav-tabs>
  <a et-nav-tab-link routerLink="./overview">Overview</a>
  <a et-nav-tab-link routerLink="./stats">Stats</a>
  <a et-nav-tab-link disabled>Coming soon</a>
</nav>

<router-outlet />
```

<StoryEmbed id="cdk-tabs-navigation--default" height="220px" />

The active link is derived from the router, honoring `routerLinkActiveOptions` when a `routerLinkActive` is present (`{ exact: false }` otherwise), and re-evaluated on every `NavigationEnd`.

`[et-nav-tabs]` accepts the same scrollable passthroughs as the inline bar (`itemSize`, `renderMasks`, `renderButtons`, `renderScrollbars`, `scrollableClass`, `direction`).

| Input (on `[et-nav-tab-link]`) | Default        | Purpose                                        |
| ------------------------------ | -------------- | ---------------------------------------------- |
| `disabled`                     | `false`        | Blocks navigation and marks the link disabled. |
| `tabIndex`                     | `0`            | Ignored while a `tabOutlet` is set.            |
| `id`                           | auto-generated | Used to label the outlet panel.                |

### With an outlet

Point the bar at an `et-nav-tabs-outlet` and the trio switches from navigation semantics to tab semantics - `role="tablist"` / `role="tab"` / `role="tabpanel"`, roving `tabindex`, and `aria-controls` / `aria-labelledby` wired between the active link and the panel:

```html
<nav [tabOutlet]="tabOutlet" et-nav-tabs>
  <a et-nav-tab-link routerLink="./one">Tab One</a>
  <a et-nav-tab-link routerLink="./two">Other Tab</a>
</nav>

<et-nav-tabs-outlet #tabOutlet>
  <router-outlet />
</et-nav-tabs-outlet>
```

Without an outlet the links stay plain navigation: the active one gets `aria-current="page"`, each keeps its own `tabIndex`, and no ARIA roles are imposed.

## Accessibility

Both bars run a `FocusKeyManager` with wrapping and home/end support:

| Key                                 | Action                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| <kbd>←</kbd> / <kbd>→</kbd>         | Move focus to the previous/next tab, wrapping at the ends. |
| <kbd>Home</kbd> / <kbd>End</kbd>    | Focus the first/last tab.                                  |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Select the focused tab.                                    |

Focus is roving, so the bar is a single tab stop: only the active header is reachable with <kbd>Tab</kbd>, and arrow keys move within. Focusing a tab does not select it - selection needs <kbd>Enter</kbd> or <kbd>Space</kbd>, which keeps keyboard users from triggering panel loads while scanning. Disabled tabs are skipped by clicks and by the selection keys, and are excluded from the tab order.

The header cells get `role="tab"` with `aria-selected`, `aria-posinset` / `aria-setsize` and `aria-controls`; the panels get `role="tabpanel"` with `aria-labelledby` back to their header. Set `contentTabIndex="0"` when a panel scrolls but contains nothing focusable, so keyboard users can still reach and scroll it.

## Styling

The structural styles ship in the CDK's [global stylesheet](/cdk/#styles). Style against `et-inline-tabs`, `et-inline-tab-header`, `et-inline-tab-label-wrapper` (`et-inline-tab-label--active`, `--is-text`), `et-inline-tabs-body-wrapper` and `et-inline-tab-body`; for nav tabs, `et-nav-tabs`, `et-nav-tab-link` and `et-nav-tabs-outlet`. Both flavors wrap the label in `et-tab-content`.

The active underline is a separate element managed by the underline directive: it carries `et-active-tab-underline--active` while active and `--no-transition` while it is being repositioned without animation.
