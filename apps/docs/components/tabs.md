# Tabs

Two flavors sharing one accessible tab-bar engine: **content tabs** (`et-tab-group`, panels in place) and **nav tabs** (`et-nav-tabs`, anchors bound to the Angular router). Import `TAB_IMPORTS` or `NAV_TAB_IMPORTS`.

## Content tabs

```html
<et-tab-group [(selectedIndex)]="activeTab" color="brand">
  <et-tab icon="et-grid-2x2" label="Overview">
    <div class="p-4">Overview content</div>
  </et-tab>

  <et-tab>
    <ng-template etTabLabel><span>🏠 Home</span></ng-template>
    <div class="p-4">Home content</div>
  </et-tab>

  <et-tab disabled label="Admin">…</et-tab>
</et-tab-group>
```

```ts
import { TAB_IMPORTS } from '@ethlete/components';
```

- `selectedIndex` is a two-way model (default `0`); disabled tabs are skipped.
- `label` + optional `icon` render the trigger, or supply a custom `ng-template etTabLabel`.
- `preserveContent` (default `true`) keeps inactive panels rendered but `hidden` + `inert`; set it to `false` for lazy rendering of only the active panel.
- `sessionMemoryKey` persists the selected tab across navigation in session storage.
- The tab bar lives inside a [scrollable](/components/scrollable), so overflowing tabs scroll with the active one centered.

<StoryEmbed id="components-tabs-tabs--default" height="380px" />

## Nav tabs

Anchors + router instead of an index - active state comes from `RouterLinkActive`, content renders through your `<router-outlet>`:

```html
<et-nav-tabs color="brand">
  <a et-nav-tab-link="/overview"><i etIcon="et-grid-2x2"></i> Overview</a>
  <a et-nav-tab-link="/settings"><i etIcon="et-pencil"></i> Settings</a>
</et-nav-tabs>

<et-nav-tabs-outlet>
  <router-outlet />
</et-nav-tabs-outlet>
```

```ts
import { NAV_TAB_IMPORTS } from '@ethlete/components';
```

`a[et-nav-tab-link]` forwards the usual `RouterLink` inputs (`queryParams`, `fragment`, `relativeTo`, …) and supports `disabled` just like content tabs. The optional `et-nav-tabs-outlet` wrapper gives the routed region proper `role="tabpanel"` semantics - place it as a sibling of `et-nav-tabs` (as above); it finds the bar that labels it automatically.

<StoryEmbed id="components-tabs-nav-tabs--default" height="380px" />

## Appearance

Both flavors accept the shared tab-bar inputs:

| Input               | Default        | Values                       |
| ------------------- | -------------- | ---------------------------- |
| `variant`           | `'secondary'`  | `'primary' \| 'secondary'`   |
| `orientation`       | `'horizontal'` | `'horizontal' \| 'vertical'` |
| `fit`               | `'content'`    | `'content' \| 'fill'`        |
| `divider`           | `true`         | Divider line under the bar   |
| `size`              | `'md'`         | `'sm' \| 'md' \| 'lg'`       |
| `color` / `surface` | -              | App-registered theme names   |

## Accessibility

Standard tabs semantics out of the box: `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`, `aria-labelledby` and roving tabindex. Arrow keys move orientation-aware (wrapping, skipping disabled), <kbd>Home</kbd>/<kbd>End</kbd> jump, <kbd>Enter</kbd> activates (nav links also on <kbd>Space</kbd>).

## Theming

Content tabs: `--et-tab-group-gap` / `--et-tab-group-header-gap` (`0px`), `--et-tab-group-trigger-padding-inline` (`16px`), `--et-tab-group-trigger-padding-block` (`12px`), `--et-tab-group-underline-size` (`2px`), `--et-tab-group-underline-radius` (`1px`), `--et-tab-group-font-size` (`1.4rem`). Nav tabs mirror them as `--et-nav-tabs-gap` / `-underline-size` / `-underline-radius` / `-font-size` plus `--et-nav-tab-link-padding-inline` / `-padding-block`. Colors come from the [surface/color theme systems](/core/theming).

## Error codes

Misplaced tabs pieces (orphan `<et-tab>`, triggers/panels outside their containers, nav pieces without `et-nav-tabs`) throw [`ET20xx` errors](/components/error-codes#tabs-et20xx) in dev mode.
