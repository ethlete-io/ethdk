# Menu

A click-triggered popup menu with roving focus, group semantics, optional checkbox/radio items and an optional search field. The trigger lives on your element; the menu itself is a template that is only instantiated while open.

::: warning Superseded by @ethlete/components
New code should use the [components menu](/components/menu) (`MENU_IMPORTS`). `MenuComponent`,
`MenuTriggerDirective`, `MenuItemDirective`, `MenuCheckboxItemComponent` and `MenuRadioItemComponent` keep
their names on top of the components overlay runtime, and gain variants, activation events, shortcut
support and a built-in search field. `MenuContainerComponent` becomes `MenuPanelDirective` (the panel is a
directive on your own element), `MenuGroupDirective` → `MenuSelectionGroupDirective`,
`MenuGroupTitleDirective` → `MenuGroupLabelComponent`, `MenuSearchTemplateDirective` → `MenuSearchDirective`,
and the checkbox/radio groups become `MenuCheckboxGroupComponent` / `MenuRadioGroupComponent`. This page
documents the CDK version, which still receives bug fixes.
:::

```html
<button [etMenuTrigger]="menuTpl" type="button">Actions</button>

<ng-template #menuTpl>
  <et-menu>
    <button etMenuItem type="button">Edit</button>
    <button etMenuItem type="button">Duplicate</button>
    <button etMenuItemDisabled etMenuItem type="button">Delete</button>
  </et-menu>
</ng-template>
```

```ts
import { MenuImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-overlay-menu--default" height="420px" />

## Anatomy

`[etMenuTrigger]` takes the `TemplateRef` of the menu and opens it on click. The template is stamped into a floating container only while the menu is open, so a page with fifty menus builds none of their contents until one is opened.

The trigger and the menu find each other through DI: the menu reads the trigger for its `aria-labelledby`, and the trigger gets `aria-controls` / `aria-expanded` back. Nothing needs wiring by hand.

| Element                                           | Role               | Purpose                                              |
| ------------------------------------------------- | ------------------ | ---------------------------------------------------- |
| `[etMenuTrigger]`                                 | `aria-haspopup`    | Opens the menu on click.                             |
| `et-menu`                                         | `menu`             | The panel. Scrollable, with a max size.              |
| `[etMenuItem]`, `et-menu-item`                    | `menuitem`         | An action. Closes the menu when activated.           |
| `[etMenuGroup]` + `[etMenuGroupTitle]`            | `group`            | A labelled section.                                  |
| `[etMenuCheckboxGroup]` + `et-menu-checkbox-item` | `menuitemcheckbox` | Multi-select items.                                  |
| `[etMenuRadioGroup]` + `et-menu-radio-item`       | `menuitemradio`    | Single-select items.                                 |
| `ng-template[etMenuSearchTemplate]`               | -                  | A search field pinned above the scrolling item list. |

## Positioning

The trigger forwards positioning inputs to the underlying floating overlay:

| Input                | Default                                                                   | Purpose                                                                                 |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `placement`          | `'bottom'`                                                                | Preferred side.                                                                         |
| `fallbackPlacements` | `['bottom', 'bottom-start', 'bottom-end', 'top', 'top-start', 'top-end']` | Tried in order when the preferred side doesn't fit.                                     |
| `offset`             | -                                                                         | Distance from the reference element.                                                    |
| `shift`              | `false`                                                                   | Slide along the reference to stay in the viewport.                                      |
| `viewportPadding`    | -                                                                         | Minimum gap to the viewport edge.                                                       |
| `referenceElement`   | the trigger                                                               | Position against a different element - e.g. a toolbar rather than the button inside it. |
| `mirrorWidth`        | `false`                                                                   | Match the reference element's width.                                                    |

`referenceElement` with `mirrorWidth` is the combination that makes several triggers in a row open menus aligned to a shared container instead of to each individual button.

The menu also auto-hides when the trigger scrolls out of view, and resizes itself to the available space - the resulting maximum is exposed as `--et-floating-max-height` and capped by `--et-menu-max-block-size`.

## Menu options

| Input (on `et-menu`)      | Default      | Purpose                                                                |
| ------------------------- | ------------ | ---------------------------------------------------------------------- |
| `orientation`             | `'vertical'` | `'vertical'` or `'horizontal'`; also sets `aria-orientation`.          |
| `renderScrollableMasks`   | `false`      | Edge fade masks on the item list.                                      |
| `renderScrollableButtons` | `false`      | Prev/next buttons on the item list.                                    |
| `scrollableClass`         | `null`       | `ngClass` value for the inner [scrollable](/cdk/scrollable) container. |

A horizontal menu also enables cursor drag-scrolling on the item list.

## Items

`[etMenuItem]` works on any element - a `<button>`, an `<a>`, a `<p>`. Activating it (click, <kbd>Enter</kbd> or <kbd>Space</kbd>) runs your own handler and then closes the menu.

```html
<button (click)="edit()" etMenuItem type="button">Edit</button>
<a etMenuItem routerLink="/settings">Settings</a>
<p [etMenuItemDisabled]="!canDelete()" (click)="remove()" etMenuItem>Delete</p>
```

`etMenuItemDisabled` sets `disabled` and `aria-disabled` and blocks activation. Note that the item does **not** make a non-interactive element focusable for you - put `etMenuItem` on a natively focusable element (`<button>`, `<a href>`) or add `tabindex` yourself.

## Groups

Wrap related items and label the section:

```html
<et-menu>
  <div etMenuGroup>
    <span etMenuGroupTitle>Danger zone</span>
    <button etMenuItem type="button">Archive</button>
    <button etMenuItem type="button">Delete</button>
  </div>
</et-menu>
```

The title gets a generated id that the group points `aria-labelledby` at, so the group announces its name.

## Checkbox & radio items

These are the CDK [form controls](/cdk/forms) in menu clothing - they bind to reactive forms exactly like `et-checkbox` and `et-radio` do, and add the correct menu roles on top:

```html
<div [formGroup]="form" etMenuCheckboxGroup>
  <span etMenuGroupTitle>Columns</span>
  <et-menu-checkbox-item etCheckboxGroupControl>All</et-menu-checkbox-item>
  <et-menu-checkbox-item formControlName="name">Name</et-menu-checkbox-item>
  <et-menu-checkbox-item formControlName="date">Date</et-menu-checkbox-item>
</div>

<div etMenuRadioGroup formControlName="sort">
  <span etMenuGroupTitle>Sort by</span>
  <et-menu-radio-item value="name">Name</et-menu-radio-item>
  <et-menu-radio-item value="date">Date</et-menu-radio-item>
</div>
```

Unlike a plain item, **selection items keep the menu open** when clicked (`closeOnInteraction` defaults to `false`) - toggling three columns shouldn't take three trips through the trigger. Set `closeOnInteraction` to close on click anyway. <kbd>Enter</kbd> always closes the menu after toggling; <kbd>Space</kbd> toggles without closing.

A checkbox item in a partially selected group reports `aria-checked="mixed"`.

## Search

Project a search field and it is pinned above the scrolling item list:

```html
<et-menu>
  <ng-template etMenuSearchTemplate>
    <et-input-field>
      <et-label>Search</et-label>
      <et-search-input />
    </et-input-field>
  </ng-template>

  @for (item of filteredItems(); track item.id) {
  <button etMenuItem type="button">{{ item.label }}</button>
  }
</et-menu>
```

With a search field present, focus lands in the input when the menu opens instead of on the first item, and the arrow keys cycle through the items and back into the input. <kbd>Escape</kbd> then behaves in two steps: while the input is focused and has a value, the first press is left to the input (clearing it) and does not close the menu; an empty input closes it.

Filtering itself is yours - the menu neither reads nor filters your items.

## Accessibility

Focus moves into the menu when it opens (the search field, or the first item) and returns to the trigger when it closes - even when the menu closes because a different overlay took over.

| Key                                 | Action                                                    |
| ----------------------------------- | --------------------------------------------------------- |
| <kbd>↓</kbd> / <kbd>→</kbd>         | Next item, wrapping to the first (or the search field).   |
| <kbd>↑</kbd> / <kbd>←</kbd>         | Previous item, wrapping to the last.                      |
| <kbd>Home</kbd> / <kbd>End</kbd>    | First / last item.                                        |
| <kbd>Enter</kbd> / <kbd>Space</kbd> | Activate the focused item.                                |
| <kbd>Escape</kbd>                   | Close the menu (see [Search](#search) for the exception). |
| <kbd>Tab</kbd>                      | Close the menu.                                           |

Focus is roving: only the focused item carries `tabindex="0"`, everything else `-1`. Clicking outside the menu closes it, and `mousedown` on an item is prevented so a click doesn't rip focus away before the menu can handle it.

## Styling

Style against `et-menu-trigger` (with `et-menu-trigger--open`), `et-menu-container`, `et-menu-body`, `et-menu`, `et-menu-item` (`--disabled`, `--focused`), `et-menu-group`, `et-menu-group-title`, `et-menu-checkbox-item` and `et-menu-radio-item`. A menu with a search field also gets `et-menu--has-search`, and its field wrapper is `et-menu-search-container`.

| Property                     | Default   | Purpose              |
| ---------------------------- | --------- | -------------------- |
| `--et-menu-max-inline-size`  | `300px`   | Maximum menu width.  |
| `--et-menu-max-block-size`   | `200px`   | Maximum menu height. |
| `--et-menu-background-color` | `#b3b3b3` | Panel background.    |
| `--et-menu-border-radius`    | `10px`    | Panel corner radius. |

The open/close animation is built in (a scale + fade from the edge the menu is anchored to) and driven by the [animation classes](/core/animations) on `et-menu-body`, with the transform origin picked from the resolved `et-floating-placement` attribute.
