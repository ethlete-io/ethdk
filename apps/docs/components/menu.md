# Menu

Accessible dropdown, context and submenu system built on the [overlay system](/components/overlays). Full keyboard navigation, typeahead, hover-open submenus, radio/checkbox selection and built-in search — import `MENU_IMPORTS` and compose.

## Anatomy

Three structural pieces: an `[etMenu]` host, a trigger inside it, and an `ng-template[etMenuSurface]` containing the `<et-menu>` panel:

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

## Live demo

<StoryEmbed id="components-menu--default" height="420px" />

## Items

- `button[et-menu-item]` / `a[et-menu-item]` — a menu row with slots for an `[etIcon]`, the label, and a trailing `<et-menu-item-shortcut>`. `variant="destructive"` switches it to the app's error color theme (the theme registered with `type: 'error'`).
- The headless `etMenuItem` directive exposes an `activated` output (`{ source: 'pointer' | 'keyboard-enter' | 'keyboard-space' }`) and a `closeOnActivate` input to control whether activating dismisses the menu.
- `<et-menu-separator />` and `<et-menu-group-label>` structure longer menus (the label is wired into group `aria-labelledby` automatically).

## Submenus

Nest an `[etMenu]` inside the surface; a row that is both `et-menu-item` and `etMenuTrigger` opens it. Arbitrary depth is supported — submenus open on hover (with intent delays) or <kbd>ArrowRight</kbd>, close on <kbd>ArrowLeft</kbd>:

```html
<div etMenu>
  <button et-menu-item etMenuTrigger type="button">
    Export as
    <et-menu-item-shortcut>›</et-menu-item-shortcut>
  </button>
  <ng-template etMenuSurface>
    <et-menu>…</et-menu>
  </ng-template>
</div>
```

## Context menus

Swap the click trigger for `[etMenuContextTrigger]` on the area that should react to right-click — the menu opens point-anchored at the cursor (and right-clicking again repositions it):

```html
<div etMenu>
  <div etMenuContextTrigger>Right click anywhere in this area</div>
  <ng-template etMenuSurface>
    <et-menu>…</et-menu>
  </ng-template>
</div>
```

<StoryEmbed id="components-menu--context-menu" height="380px" />

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

<StoryEmbed id="components-menu-with-selection--default" height="440px" />

## Search

`input[etMenuSearch]` placed as the first child of `<et-menu>` renders into the menu's header. It surfaces the query — filtering the items is your job:

```html
<et-menu>
  <input [(query)]="query" etMenuSearch placeholder="Search players…" />

  <et-menu-radio-group [(value)]="assignedPlayer">
    @for (player of filteredPlayers(); track player) {
    <et-menu-radio-item [value]="player" [closeOnActivate]="true">{{ player }}</et-menu-radio-item>
    } @empty {
    <p>No players found</p>
    }
  </et-menu-radio-group>
</et-menu>
```

For async sources, bind `[loading]` (header spinner + `aria-busy`) and `[error]` (inline `role="alert"` line) on the search input while your request runs. Typing while the menu is focused forwards characters into the search field; <kbd>Escape</kbd> clears a non-empty query before closing the menu.

<StoryEmbed id="components-menu-with-search--async" height="440px" />

## Positioning & behavior

Inputs on `[etMenu]`:

| Input                | Default        | Notes                                                                                                                                 |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `placement`          | `'auto'`       | Resolves to `bottom-start` for root menus, `right-start` for submenus/context menus                                                   |
| `fallbackPlacements` | —              | floating-ui fallbacks                                                                                                                 |
| `offset`             | `'auto'`       | Resolves to `10` with the arrow, smaller without                                                                                      |
| `viewportPadding`    | `8`            | Clearance against the viewport edge                                                                                                   |
| `arrow`              | `true`         | Floating arrow pointing at the trigger (root, trigger-anchored menus only); `arrowPadding` (default `8`) keeps it off rounded corners |
| `hoverOpen`          | `true`         | Submenu hover-open with `hoverOpenDelay` (120ms) / `hoverCloseDelay` (300ms)                                                          |
| `autoFocus`          | `true`         | Focus the panel/first item on open                                                                                                    |
| `open`               | `model(false)` | Two-way open state; methods `show()`, `hide()`, `toggle()`, `closeAll()`, `openAt(point)`                                             |

### Keyboard

| Key                              | Action                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| <kbd>↓</kbd> / <kbd>↑</kbd>      | Move the active item (wraps; integrates the search input)   |
| <kbd>→</kbd> / <kbd>←</kbd>      | Open / close a submenu level                                |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last item                                           |
| <kbd>Enter</kbd>                 | Activate (selects and dismisses)                            |
| <kbd>Space</kbd>                 | Activate (selection items toggle and keep the menu open)    |
| <kbd>Esc</kbd>                   | Close the current level                                     |
| <kbd>Tab</kbd>                   | Close the whole menu tree                                   |
| Printable keys                   | Typeahead — or forwarded into the search input when present |
