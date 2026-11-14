# Menu

Accessible dropdown, context and submenu system built on the [overlay system](/components/overlays). Full keyboard navigation, typeahead, hover-open submenus and radio/checkbox selection ship in `MENU_IMPORTS`; search is an opt-in `MENU_SEARCH_IMPORTS` add-on.

## Anatomy

Three structural pieces: an `[etMenu]` host, a trigger inside it, and an `ng-template[etMenuSurface]` containing the `<et-menu>` panel. The surface template's context provides the `menu` directive and a `close(result?)` function (`<ng-template etMenuSurface let-close="close">`):

```html
<div etMenu>
  <button etMenuTrigger et-button type="button">File</button>

  <ng-template etMenuSurface>
    <et-menu>
      <button (click)="newFile()" et-menu-item type="button">
        <i etIcon="et-plus"></i>
        New file
        <et-menu-item-shortcut>⌘N</et-menu-item-shortcut>
      </button>

      <button [disabled]="true" et-menu-item type="button">Publish</button>

      <et-menu-separator />

      <button (click)="delete()" et-menu-item variant="destructive" type="button">
        <i etIcon="et-times"></i>
        Delete
      </button>
    </et-menu>
  </ng-template>
</div>
```

```ts
import { MENU_IMPORTS, MENU_SEARCH_IMPORTS } from '@ethlete/components';
```

## Live demo

@example menu/menu-default 420px

## Items

- `button[et-menu-item]` / `a[et-menu-item]` - a menu row with slots for an `[etIcon]`, the label, and a trailing `<et-menu-item-shortcut>`. A row that also opens a submenu appends a chevron after that slot - see [Submenus](#submenus). `variant="destructive"` switches it to the app's error color theme (the theme registered with `type: 'error'`).
- The headless `etMenuItem` directive exposes an `activate` output (`{ source: 'pointer' | 'keyboard-enter' | 'keyboard-space' }`) and a `closeOnActivate` input to control whether activating dismisses the menu. Unset, the item type decides; a bare `closeOnActivate` attribute means `true`, `closeOnActivate="false"` keeps the menu open.
- `<et-menu-separator />` and `<et-menu-group-label>` structure longer menus (the label is wired into group `aria-labelledby` automatically).

## Submenus

Nest an `[etMenu]` inside the surface; a row that is both `et-menu-item` and `etMenuTrigger` opens it. The row shows the chevron itself - do not add one. Arbitrary depth is supported - submenus open on hover (with intent delays) or <kbd>ArrowRight</kbd>, close on <kbd>ArrowLeft</kbd> (swapped, and opening to the left, when the menu resolves to `direction: rtl`):

```html
<div etMenu>
  <button et-menu-item etMenuTrigger type="button">Export as</button>
  <ng-template etMenuSurface>
    <et-menu>…</et-menu>
  </ng-template>
</div>
```

## Context menus

Swap the click trigger for `[etMenuContextTrigger]` on the area that should react to right-click - the menu opens point-anchored at the cursor (and right-clicking again repositions it):

```html
<div etMenu>
  <div etMenuContextTrigger>Right click anywhere in this area</div>
  <ng-template etMenuSurface>
    <et-menu>…</et-menu>
  </ng-template>
</div>
```

@example menu/menu-context 380px

## Selection

Radio (single) and checkbox (multi) items work with `[(value)]` on their group or with signal forms via `[formField]`:

```html
<et-menu-radio-group [formField]="demoForm.sortBy">
  <et-menu-group-label>Sort by</et-menu-group-label>
  <et-menu-radio-item value="name">Name</et-menu-radio-item>
  <et-menu-radio-item value="date">Date modified</et-menu-radio-item>
</et-menu-radio-group>

<et-menu-checkbox-group [formField]="demoForm.columns">
  <et-menu-group-label>Columns</et-menu-group-label>
  <et-menu-checkbox-item value="size">Size</et-menu-checkbox-item>
</et-menu-checkbox-group>

<!-- standalone checkbox item, no group needed -->
<et-menu-checkbox-item [formField]="demoForm.showHidden">Show hidden files</et-menu-checkbox-item>
```

Activation follows menu conventions: <kbd>Enter</kbd> selects and dismisses, <kbd>Space</kbd> and pointer clicks toggle while keeping the menu open for multi-pick. Checkbox items also support `indeterminate`.

Both item kinds take an optional `icon` input (a `provideIcons`-registered icon name). The icon renders in place of the radio dot / checkmark, and the checked state shows through the icon taking the accent color instead - used by e.g. the rich text editor's alignment and text-style menus:

```html
<et-menu-radio-item value="left" icon="et-align-left">Align left</et-menu-radio-item>
```

Groups and standalone items carry the usual signal-forms surface alongside `[(value)]` / `[formField]`: `disabled`, `invalid`, `errors`, `required`, `name` and a `touched` model (groups additionally take `multiple`). The underlying headless directives are `etMenuSelectionGroup` and `etMenuSelectionItem` if you're building custom selection rows.

@example menu/menu-selection 440px

## Search

`input[etMenuSearch]` placed as the first child of `<et-menu>` renders into the menu's header. Add `MENU_SEARCH_IMPORTS` beside `MENU_IMPORTS`; it also supplies the search loading indicator and custom scrollbar. It surfaces the query - filtering the items is your job:

```html
<et-menu>
  <input [(query)]="query" etMenuSearch placeholder="Search players…" />

  <et-menu-radio-group [(value)]="assignedPlayer">
    @for (player of filteredPlayers(); track player) {
    <et-menu-radio-item [value]="player" closeOnActivate>{{ player }}</et-menu-radio-item>
    } @empty {
    <p>No players found</p>
    }
  </et-menu-radio-group>
</et-menu>
```

For async sources, bind `[loading]` (header spinner + `aria-busy`) and `[error]` (inline `role="alert"` line) on the search input while your request runs. The spinner - and the room the input makes for it - waits ~200ms before appearing ([`signalDeferredLoading`](/core/signal-utils#deferred-loading)) and fades in and out, so a query that answers within a keystroke or two neither flashes it nor shifts the text; `aria-busy` still reports the request immediately. Typing while the menu is focused forwards characters into the search field; <kbd>Escape</kbd> clears a non-empty query before closing the menu - the same reset is available programmatically via `clear()` (`#search="etMenuSearch"`).

@example menu/menu-search-async 440px

## Positioning & behavior

Inputs on `[etMenu]`:

| Input                | Default        | Notes                                                                                                                                                                                                    |
| -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placement`          | `'auto'`       | Resolves to `bottom-start` for root menus, `right-start` (`left-start` in RTL) for submenus/context menus                                                                                                |
| `fallbackPlacements` | -              | floating-ui fallbacks. Setting it opts the menu out of the placement behavior below                                                                                                                      |
| `offset`             | `'auto'`       | Resolves to `10` with the arrow, smaller without                                                                                                                                                         |
| `viewportPadding`    | `8`            | Clearance against the viewport edge                                                                                                                                                                      |
| `arrow`              | `true`         | Floating arrow pointing at the trigger (root, trigger-anchored menus only); `arrowPadding` (default `14`) keeps it off rounded corners                                                                   |
| `hoverOpen`          | `true`         | Submenu hover-open with `hoverOpenDelay` (120ms) / `hoverCloseDelay` (300ms)                                                                                                                             |
| `loop`               | `true`         | Wrap the arrow keys at the ends. Off makes them stop instead - better for a long menu, where wrapping reads as a jump somewhere else. With a search field the ends hand focus back to the field instead. |
| `autoFocus`          | `true`         | Focus the search field/first item on open, however the menu was opened - except a hover-opened submenu, which never takes focus                                                                          |
| `open`               | `model(false)` | Two-way open state; methods `show()`, `hide()`, `toggle()`, `closeAll()`, `openAt(point)`                                                                                                                |
| `disabled`           | `false`        | Ignores open requests (trigger clicks, hover, `openAt`) while set                                                                                                                                        |

`show()`, `toggle()` and `openAt(point)` take the same options object: `focus` overrides `autoFocus` for that one open (`false` to leave focus alone, `'last'` to land on the last item), and `source` records where the request came from without affecting focus.

```ts
this.menu.show(); // opens and focuses, same as a trigger click
this.menu.show({ focus: false }); // opens without moving focus
this.menu.show({ focus: 'last' }); // opens on the last item
```

### Panel placement

A root menu opens **below its trigger and stays there**, shrinking to the space it has (`--et-menu-max-height`, default `40vh`, is an upper bound - never a floor). It only moves above the trigger when less than `160px` are left below it, and if neither side has that much, the roomier one wins. Because the decision reads only the space around the trigger, never the panel's own height, **an open menu never jumps sides** - filtering a search list, an async result arriving, or the animated block-size that follows them all resize it in place.

A list longer than that scrolls, and the scroll area sits `--et-menu-padding-block` inside the panel: a scrolled option is cut a gap away from the search field's border and from the panel's rounded corners, never against them. Its cut edges fade over `--et-menu-scroll-fade-size` (`12px`; set `0px` to switch the fade off) while there is more to scroll in that direction, so the top fade appears only once the list is scrolled and the bottom one goes away at the end of the list. The fade needs scroll-driven animations - a browser without them shows the plain cut. The scroll area
carries an [`et-scrollbar`](/components/scrollbar) that auto-hides, so the panel shows a themed bar
while it scrolls instead of the platform's own.

This applies to root menus opening on the vertical axis. Submenus and context menus keep floating-ui's `flip`: they open on the x axis, where the equivalent shrink would make the panel narrower rather than shorter. Setting `fallbackPlacements` yourself also restores `flip`, since the two are alternatives - the [`minAvailableSpace`](/components/overlays#anchored-overlays-and-the-arrow) middleware replaces it rather than running alongside it.

### Keyboard

| Key                                        | Action                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| <kbd>↓</kbd> / <kbd>↑</kbd>                | Move the active item (wraps unless `loop` is off; integrates the search input)                                      |
| <kbd>↓</kbd> / <kbd>↑</kbd> on the trigger | Open the menu, or move focus into the open panel (first / last item)                                                |
| <kbd>→</kbd> / <kbd>←</kbd>                | Open / close a submenu level                                                                                        |
| <kbd>Home</kbd> / <kbd>End</kbd>           | First / last item                                                                                                   |
| <kbd>Enter</kbd>                           | Activate (selects and dismisses)                                                                                    |
| <kbd>Space</kbd>                           | Activate (selection items toggle and keep the menu open)                                                            |
| <kbd>Esc</kbd>                             | Close the current level                                                                                             |
| <kbd>Tab</kbd>                             | Close the whole menu tree                                                                                           |
| Printable keys                             | Typeahead (repeating a letter cycles through the items it starts) - or forwarded into the search input when present |

The active item shows its focus ring only while the keyboard moved it there. Moving the pointer hands the highlight to the item under it and ends the ring, also when the pointer was already resting on that item.

## Closing & focus

### Outside clicks

While a root menu is open, a `pointerdown` anywhere outside its panes (any level of the tree) closes the whole tree. The menu never swallows that press: it renders no backdrop, adds no `preventDefault()`/`stopPropagation()`, and closes without waiting for the click. The click that follows lands on whatever sits under the pointer, so a button elsewhere on the page both closes the menu and runs its own click handler.

Three presses do not close it on `pointerdown`: one inside any open pane, one on a pane that belongs to a higher overlay layer, and one on the menu's own trigger (the click that follows toggles the menu closed). A right press on a context-menu zone is also skipped, because the `contextmenu` event that follows reopens the menu at the new point.

An outside close does **not** move focus. It stays wherever the press put it (the clicked button, an input, or the body), unlike closing through item activation, <kbd>Esc</kbd> or <kbd>Tab</kbd>, which focus the trigger.

### Focus after a dialog opened from an item

Activating an item closes the menu (unless `closeOnActivate="false"`) and focuses the trigger. When the item's `(click)` or `(activate)` handler opens a dialog or any other overlay from the overlay manager, focus lands back on the **menu trigger** once that overlay closes - not on the item (which is gone with the panel) and not on the body.

The overlay records the focused element and the focus-restore chain of the overlay that owned it, and on close it focuses the first still-connected entry: the item has been removed by then, so the chain falls through to the trigger. This relies on the overlay's `restoreFocus` default (`true`) and applies only while focus is still inside the closing overlay or on the body; if the user has already focused something else, that wins. A dialog opened with `restoreFocus: false` leaves focus where it is.

## Coloring items

`etProvideColor` works on the panel (`<et-menu>`) and on a single `et-menu-item`; the nearest scope wins for that row's color tokens. The directive is not part of `MENU_IMPORTS`, so add `ProvideColorDirective` from `@ethlete/core` to the `imports` of the component whose template uses it - without it the attribute is inert. The theme name must be one your app registered with `provideColorThemesWithTailwind4()`.

```ts
import { ProvideColorDirective } from '@ethlete/core';
import { MENU_IMPORTS } from '@ethlete/components';

@Component({ imports: [MENU_IMPORTS, ProvideColorDirective], … })
```

```html
<et-menu etProvideColor="brand">
  <button et-menu-item etProvideColor="accent" type="button">Highlighted row</button>
  <button et-menu-item type="button">Regular row</button>
</et-menu>
```

The panel renders detached in the overlay container, so it re-applies the color context from the trigger's location itself; an explicit `etProvideColor` on `<et-menu>` overrides that. `variant="destructive"` on an item forces the app's error theme and takes precedence over an `etProvideColor` on the same item. Theme names such as `brand` or `accent` above belong to the example app - the SDK ships none.

## Accessibility

Full [menu-pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu/) semantics are emitted automatically:

- The trigger gets `aria-haspopup="menu"`, live `aria-expanded`, and `aria-controls` pointing at the open panel; the panel is `role="menu"` labelled by its trigger.
- Items are `role="menuitem"` - or `menuitemradio` / `menuitemcheckbox` with `aria-checked` (`"mixed"` for indeterminate) for selection items. Groups are `role="group"` labelled by their `<et-menu-group-label>`, separators `role="separator"`, shortcuts `aria-hidden`.
- Focus uses a roving tabindex over enabled items (see [Keyboard](#keyboard)) plus typeahead, and returns to the trigger when the menu closes via item activation, <kbd>Esc</kbd> or <kbd>Tab</kbd>.
- With search: the panel reflects `[loading]` as `aria-busy`, and an `[error]` renders as a `role="alert"` line wired to the input via `aria-describedby` / `aria-invalid`.

## Theming

Public tokens (defaults in parentheses): `--et-menu-min-width` (`180px`), `--et-menu-max-height` (`40vh`, caps the whole panel - header included - and is itself capped by the space next to the trigger, see [Panel placement](#panel-placement)), `--et-menu-padding-block` / `-inline` (`6px`), `--et-menu-border-radius` (`10px`, the panel), `--et-menu-item-height` (`36px`), `--et-menu-item-padding-inline` (`10px`), `--et-menu-item-gap` (`10px`), `--et-menu-item-border-radius` (`6px`), `--et-menu-item-font-size` (`14px`), `--et-menu-item-font-weight` (unset: inherits the page's weight), `--et-menu-item-icon-size` (`16px`), `--et-menu-item-submenu-icon-size` (`12px`), `--et-menu-separator-margin-block` (`6px`), `--et-menu-group-label-font-size` (`12px`), `--et-menu-search-height` (`36px`), `--et-menu-scroll-fade-size` (`12px`, see [Panel placement](#panel-placement)). Every token inherits, so a value set on `:root` or any ancestor reaches the panel, which renders detached in the overlay container. Colors come from the [surface/color theme systems](/core/theming).

## Migrating from the cdk menu

The cdk menu (`MenuImports` from `@ethlete/cdk`) is in maintenance mode. The SDK menu is a different shape: the trigger no longer takes a template, it sits inside an `[etMenu]` host next to an `ng-template[etMenuSurface]`. The mechanical symbol renames are covered by the [cdk migration](/cdk/migration) and its codemod; this table is the behavioral map.

```html
<!-- cdk -->
<button [etMenuTrigger]="menuTpl" [placement]="'bottom-start'">Menu</button>
<ng-template #menuTpl>
  <et-menu>
    <button etMenuItem>Item</button>
  </et-menu>
</ng-template>

<!-- SDK -->
<div etMenu placement="bottom-start">
  <button etMenuTrigger et-button type="button">Menu</button>
  <ng-template etMenuSurface>
    <et-menu>
      <button et-menu-item type="button">Item</button>
    </et-menu>
  </ng-template>
</div>
```

| cdk                                                                                                     | SDK                                                                             | Notes                                                                                             |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `MenuImports`                                                                                           | `MENU_IMPORTS` (+ `MENU_SEARCH_IMPORTS`)                                        |                                                                                                   |
| `[etMenuTrigger]="templateRef"`                                                                         | `[etMenu]` host + `etMenuTrigger` (no value) + `ng-template[etMenuSurface]`     | The template is the surface, not a trigger input                                                  |
| trigger input `placement`, `offset`, `viewportPadding`, `fallbackPlacements`                            | same inputs on `[etMenu]`                                                       | Defaults differ: `placement` and `offset` are `'auto'`, see [Positioning](#positioning-behavior)  |
| trigger input `shift`, `referenceElement`, `mirrorWidth`                                                | no equivalent                                                                   | No such inputs on `etMenu`                                                                        |
| `<et-menu>` (`MenuComponent`)                                                                           | `<et-menu>`                                                                     | Same selector, new panel                                                                          |
| `<et-menu>` inputs `renderScrollableMasks`, `renderScrollableButtons`, `scrollableClass`, `orientation` | no equivalent                                                                   | The panel scrolls with an auto-hiding scrollbar and fade, see [Panel placement](#panel-placement) |
| `etMenuItem` / `[et-menu-item]` / `<et-menu-item>`                                                      | `button[et-menu-item]` / `a[et-menu-item]` (or headless `[etMenuItem]`)         | The styled item is a button or anchor, not a free element                                         |
| item input `etMenuItemDisabled`                                                                         | `disabled`                                                                      |                                                                                                   |
| `et-menu-group`, `[etMenuGroup]`                                                                        | no equivalent                                                                   | Plain items need no group; selection groups below                                                 |
| `et-menu-group-title`, `[etMenuGroupTitle]`                                                             | `<et-menu-group-label>`                                                         | Wired into group `aria-labelledby`                                                                |
| `et-menu-radio-group` + `<et-menu-radio-item>`                                                          | `<et-menu-radio-group>` + `<et-menu-radio-item>`                                | `[(value)]` or `[formField]` on the group; see [Selection](#selection)                            |
| `et-menu-checkbox-group` + `<et-menu-checkbox-item>`                                                    | `<et-menu-checkbox-group>` + `<et-menu-checkbox-item>`                          | `[(value)]` or `[formField]`; items also stand alone                                              |
| radio/checkbox item input `closeOnInteraction`                                                          | `closeOnActivate`                                                               | Both default to keeping the menu open on a pointer click; see [Selection](#selection)             |
| `<ng-template etMenuSearchTemplate>` with a form input                                                  | `input[etMenuSearch]` as first child of `<et-menu>`                             | Filtering the items is your job, see [Search](#search)                                            |
| (none)                                                                                                  | `activate` output and `closeOnActivate` input on the item                       | The cdk item had no output                                                                        |
| (none)                                                                                                  | `open` model, `show()` / `hide()` / `toggle()` / `closeAll()` / `openAt(point)` | Programmatic and two-way open state                                                               |
| `MENU_TRIGGER_TOKEN`, `MENU_ITEM_TOKEN`                                                                 | inject `MenuTriggerDirective` / `MenuItemDirective` directly                    | Per the [cdk migration](/cdk/migration) symbol index                                              |

## Error codes

Structural misuse (pieces outside `[etMenu]`, missing surface, selection items without values) throws [`ET13xx` errors](/components/error-codes#menu-et13xx) in dev mode.
