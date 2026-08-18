# Changelog

## 1.0.0-next.56

### Major Changes

- [`98dc861`](https://github.com/ethlete-io/ethdk/commit/98dc861d1cac3fe8e827a8d2e733d75e5e9ff595) Thanks [@TomTomB](https://github.com/TomTomB)! - A loading button keeps DOM focus and its place in the tab order. Native `disabled` and
  `tabindex="-1"` now come from `disabled` alone, and the directive blocks the click instead.

- [`37e4cad`](https://github.com/ethlete-io/ethdk/commit/37e4cad03139aab434f84497dfea415e630b8f07) Thanks [@TomTomB](https://github.com/TomTomB)! - Replaced the color input's native `<input type="color">` with the SDK's own picker: a saturation area, hue and optional opacity tracks, preset swatches, a hex field and an eyedropper. `nativeControl` and `syncFromNativeInput()` are gone.

- [`d9e4622`](https://github.com/ethlete-io/ethdk/commit/d9e4622134e5d08bef3b6ee082c4fbaa82d27b37) Thanks [@TomTomB](https://github.com/TomTomB)! - `etFocusRing`'s `disabled` input is now `focusRingDisabled`, so it stops swallowing a native
  control's own `[disabled]` binding.

- [`e265fa6`](https://github.com/ethlete-io/ethdk/commit/e265fa6286e063e55ecf0c7cf72fbc3ad4b1f4c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid items take span bounds per breakpoint, through `constraints.perBreakpoint` on a registration or
  `[perBreakpointConstraints]` on `et-grid-item`. `getConstraintsForColumns()` is now
  `getConstraintsForBreakpoint()`.

### Minor Changes

- [`990ca0b`](https://github.com/ethlete-io/ethdk/commit/990ca0bff8e8ff9648bbc41d24508c1ae99be6f9) Thanks [@TomTomB](https://github.com/TomTomB)! - Added `notations` to `et-color-input`: the picker's entry field can switch between hex, `rgb()` and `hsl()`, follows what the user types, and pins to one notation with an advisory when it converts. The emitted value stays hex.

- [`c3ca8c7`](https://github.com/ethlete-io/ethdk/commit/c3ca8c73b0c46fa5366a965b1c156f41ade8d2c1) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `et-command-palette`: a searchable dialog over commands any part of an app registers with
  `registerCommands`, ranked and highlighted as you type, opened by the opt-in `etCommandPaletteShortcut`.

- [`59e7148`](https://github.com/ethlete-io/ethdk/commit/59e7148139afa81c5df4545af34533c2734f8876) Thanks [@TomTomB](https://github.com/TomTomB)! - Date & time inputs: `timeZone` reads and writes a field in another zone, with a second line naming
  the same moment where the reader is.

- [`e57d408`](https://github.com/ethlete-io/ethdk/commit/e57d408ce5a60b24f4c24b8e55ba4fc222b52a8c) Thanks [@TomTomB](https://github.com/TomTomB)! - A readonly `et-dropzone` stops looking like a drop target: no action buttons, a solid border, and
  an empty one reads "No files" instead of the drop prompt. The prompt now comes from the
  `DROPZONE_LABELS` set, which it never read before.

- [`d9e4622`](https://github.com/ethlete-io/ethdk/commit/d9e4622134e5d08bef3b6ee082c4fbaa82d27b37) Thanks [@TomTomB](https://github.com/TomTomB)! - Readonly and disabled read the same way on every form control: readonly shows a plain cursor and
  no hover, disabled shows `not-allowed`. `et-dropzone` gained a `readonly` input.

- [`990ca0b`](https://github.com/ethlete-io/ethdk/commit/990ca0bff8e8ff9648bbc41d24508c1ae99be6f9) Thanks [@TomTomB](https://github.com/TomTomB)! - Added a `warnings` input to the text-field controls, so a control without a signal-forms binding can show an advisory in the field's support region. `hsl()` and `hsla()` are now read wherever the color validators read a color.

- [`1e66670`](https://github.com/ethlete-io/ethdk/commit/1e66670e66307402d5849545146d6ca4e445693f) Thanks [@TomTomB](https://github.com/TomTomB)! - A menu row that opens a submenu now renders its own chevron icon, so remove any manual arrow you put in its `<et-menu-item-shortcut>`. Size it with `--et-menu-item-submenu-icon-size` (`12px`).

- [`a98b5a4`](https://github.com/ethlete-io/ethdk/commit/a98b5a4381528ba81b7a0f16c19b27aac9df5055) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: `appearance="cards"` paints each row from the surface one elevation above the table's instead of tinting it, so a form field or `etAutoSurface` inside a card resolves its elevation from the card.

- [`98160bc`](https://github.com/ethlete-io/ethdk/commit/98160bc372867c9d42045ef0f1fa3531af553d10) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: a column can be marked `disabled`, which turns off its sortable header, its filter
  menu and its column menu. The cells keep their values.

### Patch Changes

- [`a2fb582`](https://github.com/ethlete-io/ethdk/commit/a2fb58228af561278546ac0a183ad14fad33bf2e) Thanks [@TomTomB](https://github.com/TomTomB)! - Stop a white ring from flashing around the checkbox inside a card choice field on blur

- [`f7803bf`](https://github.com/ethlete-io/ethdk/commit/f7803bf86eca07861610053f456f5c8b7b2f69f1) Thanks [@TomTomB](https://github.com/TomTomB)! - The color picker's hex field is now an `et-form-field` with an `et-input`, so it carries the library's hover, focus and disabled treatment instead of a hand-rolled border.

- [`f9e1f04`](https://github.com/ethlete-io/ethdk/commit/f9e1f04c06d82636036584f97b76909f789b600c) Thanks [@TomTomB](https://github.com/TomTomB)! - The color picker's notation switch now sits after the value, next to the eyedropper, instead of between the preview swatch and the value - and its hover treatment no longer sticks after a tap on a touch device.

- [`1db9c9d`](https://github.com/ethlete-io/ethdk/commit/1db9c9dbfedeb02b385306f45d5bcc680da33f6e) Thanks [@TomTomB](https://github.com/TomTomB)! - A CSV export now writes an empty field for a column whose `exportValue` reports an empty cell,
  instead of falling back to the column's `value` - which wrote `[object Object]` whenever that value
  was an object.

- [`80f9bae`](https://github.com/ethlete-io/ethdk/commit/80f9bae88427b1697917fb19e1e8118b93b5efdf) Thanks [@TomTomB](https://github.com/TomTomB)! - Select, cascader, date and time picker and color input panels now close as soon as focus lands outside them, so a `Tab` out of the panel no longer leaves it open behind the page.

- [`9052e42`](https://github.com/ethlete-io/ethdk/commit/9052e4257beef2e7b4fa4c87ec18ca986615a92b) Thanks [@TomTomB](https://github.com/TomTomB)! - A text form field is its default `md` height on the frame the router creates it in, instead of
  40px until `data-size` lands one frame later.

- [`82450c6`](https://github.com/ethlete-io/ethdk/commit/82450c608ac5ac4fa4f6af29a89cc5e649021be7) Thanks [@TomTomB](https://github.com/TomTomB)! - Menu: a scrolling option list is cut inside the panel instead of on the search field's border, and its cut edges fade while more can be scrolled. Size the fade with `--et-menu-scroll-fade-size`.

- [`a824a29`](https://github.com/ethlete-io/ethdk/commit/a824a29f52e1eb301c6327bbfdd52703c759bd2f) Thanks [@TomTomB](https://github.com/TomTomB)! - Lock body scroll for any overlay that shows a backdrop, including one a breakpoint switch gives a backdrop while it is open.

- [`2352137`](https://github.com/ethlete-io/ethdk/commit/235213735ede4c3542b7796d378e008bcab50bdc) Thanks [@TomTomB](https://github.com/TomTomB)! - An overlay strategy switch between a backdropped and a backdrop-less shape now adds or
  removes the backdrop instead of keeping the one it mounted with. `elements.backdropElement`
  is a signal.

- [`1548753`](https://github.com/ethlete-io/ethdk/commit/15487535b707dbc0478221a0e1421e17014f1e8c) Thanks [@TomTomB](https://github.com/TomTomB)! - Rating: a mixed rating draws each star as a dashed accent outline rather than a dashed rule
  under the row, so the state reads on the stars.

- [`c8eee9b`](https://github.com/ethlete-io/ethdk/commit/c8eee9b4d169a8b7d706e4c37a7c07f496bdb44a) Thanks [@TomTomB](https://github.com/TomTomB)! - The rich text editor toolbar no longer shows a doubled or a dangling divider when an opt-in tool
  between two dividers is not registered.

- [`d9e4622`](https://github.com/ethlete-io/ethdk/commit/d9e4622134e5d08bef3b6ee082c4fbaa82d27b37) Thanks [@TomTomB](https://github.com/TomTomB)! - `et-checkbox-group-select-all` keeps its mixed state while the whole group is disabled.

- [`018d98e`](https://github.com/ethlete-io/ethdk/commit/018d98eb5020176ee01f329ca2087519a500b7ce) Thanks [@TomTomB](https://github.com/TomTomB)! - Keep a drag surface inside a sheet or a notification from dragging it away - a color picker area or a slider now keeps its own gesture.

- [`44f159c`](https://github.com/ethlete-io/ethdk/commit/44f159c08659301a24c0854bb6f9e0d731fbad9d) Thanks [@TomTomB](https://github.com/TomTomB)! - A skeleton bone with no explicit `--et-skeleton-size` is one line of text tall again, instead of
  collapsing to zero height.

- [`d9e4622`](https://github.com/ethlete-io/ethdk/commit/d9e4622134e5d08bef3b6ee082c4fbaa82d27b37) Thanks [@TomTomB](https://github.com/TomTomB)! - A slider thumb no longer keeps its focus ring after a mouse press. The ring is now keyboard-only.

- [`a98b5a4`](https://github.com/ethlete-io/ethdk/commit/a98b5a4381528ba81b7a0f16c19b27aac9df5055) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: a detail row is sized and pinned to the scroll viewport, so expanded content stays where the reader is looking on a table that scrolls sideways.

- [`a98b5a4`](https://github.com/ethlete-io/ethdk/commit/a98b5a4381528ba81b7a0f16c19b27aac9df5055) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: `etTableDragScroll` leaves a press that lands in content with a scrollbar of its own to that content, instead of panning the list behind it.

- [`5bb741c`](https://github.com/ethlete-io/ethdk/commit/5bb741c53340aae1bd77ad289eb416824fe21abf) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: a table wide enough to scroll ends its header band where the last column does, instead of 20px
  past the rows under it.

- [#3068](https://github.com/ethlete-io/ethdk/pull/3068) [`3fcfcac`](https://github.com/ethlete-io/ethdk/commit/3fcfcac3a351e6feaa54f4351c23f3403694d435) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: keep the header row at one height while scrolling sideways - it used to grow and shrink as pinned
  columns covered and uncovered the filter and column-menu triggers.

- [`c1c282c`](https://github.com/ethlete-io/ethdk/commit/c1c282c428d24d54a24ea03fa9e1307799c82815) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: a sortable column header takes a hover and a pressed tint, so it reads as a
  control rather than as a label.

- [`af09c04`](https://github.com/ethlete-io/ethdk/commit/af09c0477395d61421c9effea90116c7b4fce04f) Thanks [@TomTomB](https://github.com/TomTomB)! - A hovered or held sortable table header tints a box around its own label, instead of a band of colour
  across the whole column.

- [`af09c04`](https://github.com/ethlete-io/ethdk/commit/af09c0477395d61421c9effea90116c7b4fce04f) Thanks [@TomTomB](https://github.com/TomTomB)! - A table row that reacts to a click takes a pressed tint while it is held, so a row answers a press
  the way every other control in the library does.

- [`25257b1`](https://github.com/ethlete-io/ethdk/commit/25257b11e382c01db23bad0725be99b6b037ac68) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: a `restoreState()` that lands before the `columns` input is populated keeps its column
  visibility, which the declared `hidden` used to overwrite.

- [`c1c282c`](https://github.com/ethlete-io/ethdk/commit/c1c282c428d24d54a24ea03fa9e1307799c82815) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: a focused row's ring keeps its ends, which a pinned select or expander cell
  used to paint over.

- [`a98b5a4`](https://github.com/ethlete-io/ethdk/commit/a98b5a4381528ba81b7a0f16c19b27aac9df5055) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: an appearance no longer paints the tables nested inside it, so a sub table in a detail row keeps its own appearance.

- [`46fa7a5`](https://github.com/ethlete-io/ethdk/commit/46fa7a5ab2cf0509a271d37f1a891b5f8d0fa49f) Thanks [@TomTomB](https://github.com/TomTomB)! - Avatar, badge, button, FAB and icon button no longer paint a full-strength primary fill while the
  element is still unstyled, so a route swap cannot flash a solid primary disc.

## 1.0.0-next.55

### Minor Changes

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: a `cards` row keeps its rounded ends at a pinned column, the empty and error messages centre on the scroll viewport, and only a pinned block's outermost cell marks its edge.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: add `etTableDragScroll` (`TABLE_DRAG_SCROLL_IMPORTS`), which pans a wide table by dragging anywhere in it, and `<et-table-column-chooser>` takes a `variant` for its trigger.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: `--et-table-header-background-color` paints the sticky header row and the footer bar over whatever the appearance would have used, and a pinned column's edge mark no longer reaches into the gaps between cards.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: add `etTablePageStickyHeader` (`TABLE_PAGE_STICKY_HEADER_IMPORTS`), which pins the header row of a page-scrolled table to the viewport rather than to the table's own scroll container.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: the pin shadow takes a colour per axis - `--et-table-pin-shadow-color-inline` and `--et-table-pin-shadow-color-block` - both falling back to `--et-table-pin-shadow-color`.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: a column reorder no longer pans the table under itself when `etTableDragScroll` is on, and it auto-scrolls while held near an inline edge so a column can be dropped past the visible range.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: card rows take `--et-table-row-border-color`, which recolours the ring and the corner a pinned column holds together; `transparent` gives cards that read by their tint alone.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: `etTableSelection` takes `side: 'start' | 'end'`, a feature can register a utility column on either edge through `TableLeadColumn.side`, and `<et-table-column-chooser>` takes a `size` for its trigger.

### Patch Changes

- [`32d6627`](https://github.com/ethlete-io/ethdk/commit/32d66278c9905d079e0692e7bb53a8291d066381) Thanks [@TomTomB](https://github.com/TomTomB)! - Menu: a scrolled option no longer paints in the gap under the search field. The block padding moved off the scrollport onto its content, so the list is clipped at the search field's edge.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: a `cards` row keeps its rounded end while the table is scrolled sideways, instead of showing the row's ring drawn straight out past it.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: a pinned cell paints what its row is painted on, a card's ring no longer seams between two pinned cells, a covered column's menus close, and focus rings are drawn inset so a cell cannot clip them.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: the header's filter and column-menu triggers go from a 24px box with a 14px icon to 28px with a 16px icon, off the WCAG 2.2 target-size floor.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: `etTableResize`'s grip draws its hairline on the header cell's trailing edge instead of 3px inside it, so it lines up with the column rules beside it.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`cc353a6`](https://github.com/ethlete-io/ethdk/commit/cc353a64e419b6cb24f3ee1e82264cf35726ae20) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: `restoreState` keeps the sort and the filters a bound `rowsSource` publishes, so a layout-only state no longer drops the header's sort arrow while the rows stay sorted.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`4c5ef17`](https://github.com/ethlete-io/ethdk/commit/4c5ef174e643c068f9645f2de914e08fc2be08b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: a row link covers the whole row again when its column is pinned, the utility cells stay pinned in a linked row, and the scroll fades read on a dark surface.

- [#3067](https://github.com/ethlete-io/ethdk/pull/3067) [`dcf0120`](https://github.com/ethlete-io/ethdk/commit/dcf0120dd3e877ed60fb797b5b792384ee28b781) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: the sort arrow fades in only for a sort the reader just asked for. A sort that arrives from a URL, a restored state or a bound `rowsSource` now paints the arrow already in place.

## 1.0.0-next.54

### Minor Changes

- [`4f5d8d1`](https://github.com/ethlete-io/ethdk/commit/4f5d8d19e39fe1565934592746ad6b66448fc2ea) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: `rowLink` makes every row a real link (with `etTableRowRouterLink` for router commands), and
  `appearance="cards"` gives each row a card of its own.

### Patch Changes

- [`8903d9d`](https://github.com/ethlete-io/ethdk/commit/8903d9d203da42ecaf9123f97e84297e1c454b3e) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: the row that ends the table no longer draws a divider under itself, so a `divided` table stops
  closing on a line hanging in empty space.

## 1.0.0-next.53

### Patch Changes

- [`68db91f`](https://github.com/ethlete-io/ethdk/commit/68db91fb975378cccebc4ad99f59365eba90fb43) Thanks [@TomTomB](https://github.com/TomTomB)! - - `etAutoSurface`, `et-grid-item` and `et-form-field` elevate above an app's root surface, instead of staying inherited.
  - An unset `etProvideSurface` reports the surface it inherits, so content below it no longer resolves one elevation too low.
  - Adds `injectParentSurface()`.

- [`4044a00`](https://github.com/ethlete-io/ethdk/commit/4044a0007de55d25b5a697c6e4190e21d68d022f) Thanks [@TomTomB](https://github.com/TomTomB)! - - Notifications: a toast keeps one elevation, paints above overlays, and keeps out of every reserved viewport edge.
  - Query devtools: a side dock reserves the edge it covers.
  - `SurfaceContextTracker` drops `topType` / `topElevation`.

- [`3122607`](https://github.com/ethlete-io/ethdk/commit/3122607d1727844a2d987032f45ad631f678c2ca) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlays and floating chrome now keep out of space a surface above the page reserved with `reserveOverlayViewportSpace()` - so a dialog, menu or toast is no longer stacked under the docked query devtools panel.

## 1.0.0-next.52

### Patch Changes

- [`5c1190a`](https://github.com/ethlete-io/ethdk/commit/5c1190ac76c244ff1c293b390dd599ed016d26de) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlays: a press on a surface stacked above them no longer counts as an outside press, so working in the query devtools leaves an open dialog, sheet, menu, select or tooltip alone.

## 1.0.0-next.51

### Patch Changes

- [#3063](https://github.com/ethlete-io/ethdk/pull/3063) [`37067ce`](https://github.com/ethlete-io/ethdk/commit/37067cee67c5cd360360a5f59c29f58afc08e62c) Thanks [@TomTomB](https://github.com/TomTomB)! - A single-scheme app no longer needs a root `etProvideSurface`: its default surface paints `:root` unconditionally once the surface CSS is regenerated, and the outermost provider resolves it through the new `injectDefaultSurfaceTheme()` / `injectSurfaceType()`.

## 1.0.0-next.50

### Minor Changes

- [`4c322ab`](https://github.com/ethlete-io/ethdk/commit/4c322ab07f2f5cdfb2ef72bc94044eab434dee3c) Thanks [@TomTomB](https://github.com/TomTomB)! - Buttons take an optional `progress` input (`0`-`100`) that makes the loading spinner determinate.

- [#3061](https://github.com/ethlete-io/ethdk/pull/3061) [`7cd3da8`](https://github.com/ethlete-io/ethdk/commit/7cd3da8342d0d619f06154d4155cfafedbed28f4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlays: `data-et-overlay-layer` (or a per-open `zIndex`) puts an overlay above the default stacking level, which is how the query devtools panel and its toggle now stay visible over an app's own modals and tooltips.

### Patch Changes

- [`0b67ec5`](https://github.com/ethlete-io/ethdk/commit/0b67ec598b899c4c4716588a15a8c3cdd3335d87) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix the spinner's `track` never painting: `--et-spinner-track-color` was registered with an
  `initial-value`, so its default could not apply. It now defaults to `currentColor` at 24%, and a
  button's determinate loading spinner shows its track.

## 1.0.0-next.49

### Minor Changes

- [`78c5152`](https://github.com/ethlete-io/ethdk/commit/78c51528ec11540e64a6c508eda97b789295c6b2) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: `[etForm]` submits a `<form>` through its signal form - no submit handler, no
  `preventDefault()` - and an invalid attempt now lands the user on the first error via
  `focusFirstInvalidField()`.

- [`56ff41a`](https://github.com/ethlete-io/ethdk/commit/56ff41aaaec7bfa313d750da98fae984188ec5c2) Thanks [@TomTomB](https://github.com/TomTomB)! - Nav tabs: a router-driven tab link no longer selects itself on click. The underline stays on the page currently rendered while a navigation guard is deciding, moves once the guard lets the navigation through, and never moves when one refuses.

- [`56ff41a`](https://github.com/ethlete-io/ethdk/commit/56ff41aaaec7bfa313d750da98fae984188ec5c2) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay router navigations stay synchronous for as long as their guards answer synchronously, instead of going async as soon as any guard is registered.

- [`56ff41a`](https://github.com/ethlete-io/ethdk/commit/56ff41aaaec7bfa313d750da98fae984188ec5c2) Thanks [@TomTomB](https://github.com/TomTomB)! - `createOverlayUnsavedChangesGuard` now guards overlay router navigations too, so a form on an overlay route needs no separate navigation guard.

### Patch Changes

- [`4350d8e`](https://github.com/ethlete-io/ethdk/commit/4350d8e1eca00447ba130ec5a0ce43a64cfc4496) Thanks [@TomTomB](https://github.com/TomTomB)! - Form controls implement signal forms' `focus()`, so `field().focusBoundControl()` reaches the control inside a wrapper like `<et-input>` instead of doing nothing.

- [`ae2349f`](https://github.com/ethlete-io/ethdk/commit/ae2349f9f00ccf1d4a2d038343b651d29a0f4cf3) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: marking a field touched programmatically (a `submit()` attempt, `markAsTouched()`) now shows
  the error on `et-input`, `et-textarea`, `et-checkbox`, `et-switch` and the other wrapped controls.

- [`71c680d`](https://github.com/ethlete-io/ethdk/commit/71c680df153cd982c440d655436424976c8fec82) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: fade the value under the clear button, busy spinner and select loading indicator with a
  mask, so it no longer paints a block of the surface background over a differently coloured field.

- [`8b14f9e`](https://github.com/ethlete-io/ethdk/commit/8b14f9e8bd9ceaaada9da7e55e048484404e62a6) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: a projected `etSelectSearch` input without a placeholder of its own now shows the select's `placeholder`, and stops offering a caret and text cursor while the field is readonly.

- [`bcaa5a7`](https://github.com/ethlete-io/ethdk/commit/bcaa5a7ddaa8535d3eb366bcd05fa7fe570ea818) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: only virtualize data-driven `options` past ~40 visible rows - short lists render in full, without a scroll listener or the panel's width floor.

## 1.0.0-next.48

### Minor Changes

- [`15d88c6`](https://github.com/ethlete-io/ethdk/commit/15d88c6abb6ead4596357705b9c899e1f6474567) Thanks [@TomTomB](https://github.com/TomTomB)! - Loading indicators wait before they show and hold once shown, so a fast response leaves no flicker - via the new `signalDeferredLoading` from `@ethlete/core`, applied across form field, select, cascader, menu and table.

- [`2c5d867`](https://github.com/ethlete-io/ethdk/commit/2c5d867ac6700549e17883ce4fb1d825f91d3e90) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: the clear button and busy spinner overlay the value behind a background fade instead of claiming space; a focused or end-aligned control stops short of them so its caret and tail stay visible.

- [`47f0649`](https://github.com/ethlete-io/ethdk/commit/47f0649888eda9a69c757912d06bdc24223fe180) Thanks [@TomTomB](https://github.com/TomTomB)! - Nav tabs: the underline no longer jumps to the clicked tab and snaps back when the overlay router has a navigation guard. The router now exposes `navigationPending`.

- [`47f0649`](https://github.com/ethlete-io/ethdk/commit/47f0649888eda9a69c757912d06bdc24223fe180) Thanks [@TomTomB](https://github.com/TomTomB)! - Added `button[et-overlay-nav-tab-link]`, a nav tab link driven by the overlay router, so `<et-nav-tabs>` can drive tabbed navigation inside an overlay.

- [`c1abd8c`](https://github.com/ethlete-io/ethdk/commit/c1abd8cf246a71f4ebfd548cdccd215883c29f52) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay router: the transition direction now follows where the two routes sit relative to each other, so navigating to an earlier page plays in reverse. Explicit directions and per-route hints still win.

- [`b94ce92`](https://github.com/ethlete-io/ethdk/commit/b94ce92a6aeeaddf5e33b5fe8111f46a7f7340e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay router: added `registerNavigationGuard(guard)`. It runs before every route change, including browser back and forward, and cancels the navigation when it resolves `false`.

- [`2c5d867`](https://github.com/ethlete-io/ethdk/commit/2c5d867ac6700549e17883ce4fb1d825f91d3e90) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: options already on screen stay put under an indeterminate busy bar instead of being replaced by a spinner, and load-more becomes a loading row in its own place.

### Patch Changes

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`3090aaf`](https://github.com/ethlete-io/ethdk/commit/3090aaf84840642f038e96a88d792bbcd19d0ee3) Thanks [@github-actions](https://github.com/apps/github-actions)! - The date/time picker panels no longer change sides while open: drilling from the day grid to the
  month or year grid resizes the panel in place instead of dropping a picker that opened above the
  field back below it.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`350c9b7`](https://github.com/ethlete-io/ethdk/commit/350c9b712d57304a026586e7b32070ae4161ef29) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date-time inputs and the time picker no longer commit a value nobody chose: a lone day, hour, minute or AM/PM pick is held until the rest lands. The time picker's range band now marks the options inside the range.

- [#3059](https://github.com/ethlete-io/ethdk/pull/3059) [`4d91f8b`](https://github.com/ethlete-io/ethdk/commit/4d91f8b2a8fd93fb6d27a14f0a86b8e1b06ec4d6) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-duration-input` now accepts `aria-label` and `aria-labelledby` and forwards them onto its field,
  so a duration field with no projected `et-label` can be named instead of throwing `ET2201`.

- [`efcc723`](https://github.com/ethlete-io/ethdk/commit/efcc723c15c64314e42cbfa7bb3bb8113a0c6df5) Thanks [@TomTomB](https://github.com/TomTomB)! - An inline `<et-overlay-sidebar>` now lays itself out as the routed content's first grid column, and leaves the grid once it collapses into its page. Width: `--et-overlay-sidebar-inline-size` (default `240px`).

- [`2c5d867`](https://github.com/ethlete-io/ethdk/commit/2c5d867ac6700549e17883ce4fb1d825f91d3e90) Thanks [@TomTomB](https://github.com/TomTomB)! - Progress bar: `--et-progress-bar-height` and `--et-progress-bar-border-radius` now take effect when set on the element or an ancestor - they were registered as non-inheriting and silently kept their defaults.

- [`f66776c`](https://github.com/ethlete-io/ethdk/commit/f66776c8b30cc9ba0c5e3178d64a1c36b4e96f7b) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix the select panel opening too tall (and animating down) when a consumer adds block padding to `.et-select-option` - the offscreen placeholder size no longer stacks on top of the row height.

## 1.0.0-next.47

### Minor Changes

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`9a3a38d`](https://github.com/ethlete-io/ethdk/commit/9a3a38d4e6694997353acc47af25607304631856) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: add `colorContrast(path, { against })`, which validates a color field against another field of
  the same form, plus the `getColorContrastRatio()` helper and `WCAG_CONTRAST_RATIOS`.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`4a3a3cf`](https://github.com/ethlete-io/ethdk/commit/4a3a3cf50d8ffd59a1331b7e3afe8485e813e673) Thanks [@github-actions](https://github.com/apps/github-actions)! - The component generator takes a `--category`, filing the new story under `Components/<Category>/<Name>` and matching the generated docs page's `<StoryEmbed>` id to it.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`2dc1ada`](https://github.com/ethlete-io/ethdk/commit/2dc1ada857e507852d8ca5fbe3dd3dd2c589ec9e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-date-time-range-input`, a start/end control whose picker pairs a range calendar with `et-time-picker`'s new `mode="range"` - one set of columns holding both times.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`99e4f02`](https://github.com/ethlete-io/ethdk/commit/99e4f02accefecf2ef62bfaabb7f32e994893fcc) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: **breaking** - `createGridAdapter` now takes one options object and declares the breakpoints it
  maps, so both directions are typed per breakpoint. New `mapGridLayout` and `adapter.breakpoints`.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`acdbd60`](https://github.com/ethlete-io/ethdk/commit/acdbd607a3f3250600b48d72ca0c20fa9e0bbd63) Thanks [@github-actions](https://github.com/apps/github-actions)! - Progress steps: project `[etProgressStepDescription]` into a step for a second, muted line under the label, sized by the new `--et-progress-step-description-font-size` token.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`24545d0`](https://github.com/ethlete-io/ethdk/commit/24545d0751f77d7863f58e9c20448732112612de) Thanks [@github-actions](https://github.com/apps/github-actions)! - Selection card: project a mark and a price into the ends with `[etSelectionCardLeading]` / `[etSelectionCardTrailing]`, and move the control with `controlPosition`.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`bb766d5`](https://github.com/ethlete-io/ethdk/commit/bb766d59ac271f541286822adc0aebae86fbbcbc) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-time-range-input`, a start/end time control whose picker is one range-mode `et-time-picker`, plus a `dialogLabel` input on every date/time picker control. All three range controls now stack their two fields when the field is too narrow to show both values.

### Patch Changes

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`33d6ba8`](https://github.com/ethlete-io/ethdk/commit/33d6ba87a1c1cc39875a5b2aa869f3b1d38bcbc1) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: projecting your own `et-grid-item` no longer trips the dev check for an unregistered type, and an item rendered by both a registration and a projected item now reports `ET1905`.

- [#3058](https://github.com/ethlete-io/ethdk/pull/3058) [`0e5e789`](https://github.com/ethlete-io/ethdk/commit/0e5e789a7ac6b7d157a6dcec60341243434b2ede) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select: a content-sized panel (`[mirrorPanelWidth]="false"`) no longer resizes while scrolling a virtualized option list - it keeps the widest width it has needed until the search query changes.

## 1.0.0-next.46

### Minor Changes

- [`4d77d66`](https://github.com/ethlete-io/ethdk/commit/4d77d66c11edde2a0355da66a011737f9df42682) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: **breaking** - the `initialItems` input is now `items`, and the handle's `items()` signal is
  now `currentItems()`.

## 1.0.0-next.45

### Minor Changes

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`789e597`](https://github.com/ethlete-io/ethdk/commit/789e5973dd8cb80ba7e6794d70118cc54137ba53) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: add `agendaDays` for an agenda longer than a week, and head the months a long agenda crosses into.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`3765630`](https://github.com/ethlete-io/ethdk/commit/376563095943a74224629819ac29a61281d12198) Thanks [@github-actions](https://github.com/apps/github-actions)! - Drag scheduler all-day entries on the week and day views: sideways to move them,
  by their leading or trailing edge to change which days they span.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`3624dcb`](https://github.com/ethlete-io/ethdk/commit/3624dcbe7008a5e3ce1ccb9a44f913adb6e9e4b8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Drag a scheduler appointment to another time: move it on the month, week and day
  views, resize it by its edges on week and day. Emits the new
  `appointmentReschedule`.

### Patch Changes

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`0406311`](https://github.com/ethlete-io/ethdk/commit/04063112c5c3d751b6097dcf20530e0afedb6396) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: auto-place items on breakpoints their layout has no position for, instead of
  stacking them all on the grid origin. An empty `layout: {}` no longer warns.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`0aba085`](https://github.com/ethlete-io/ethdk/commit/0aba085d026c4bd76734bea061c1c861de006865) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: `GridDebugComponent` is generic in the item payload, so `<et-grid-debug>` now accepts a typed
  grid instead of only `GridComponent<unknown>`.

- [#3056](https://github.com/ethlete-io/ethdk/pull/3056) [`9a93121`](https://github.com/ethlete-io/ethdk/commit/9a931214fc0d4f286e931081c786656ee427946e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Selection lists (`et-radio-group`, `et-checkbox-group`, `et-segmented-button-group`) accept `aria-label` / `aria-labelledby` and count as labelled, so a group named from outside its field no longer trips the field's labelling guard (ET2201) and no longer needs a visually hidden `<et-label>`.

## 1.0.0-next.44

### Major Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`695c2e9`](https://github.com/ethlete-io/ethdk/commit/695c2e9d08f2e283816488938b446009acd4ad99) Thanks [@github-actions](https://github.com/apps/github-actions)! - Dropzone: removing a value the control started with no longer fires the `delete` request. Opt back in per config with `includeExisting: true`.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`7245dc7`](https://github.com/ethlete-io/ethdk/commit/7245dc788ddab057e39b8ac8aeb1e7c019baa2dc) Thanks [@github-actions](https://github.com/apps/github-actions)! - The devtools panel moved out of `@ethlete/components` into its own package, `@ethlete/query-devtools`, where `<et-query-devtools-lazy>` loads it on first open instead of shipping it - 125 kB gz an application no longer pays.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`695c2e9`](https://github.com/ethlete-io/ethdk/commit/695c2e9d08f2e283816488938b446009acd4ad99) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select and cascader render their clear button and chevron in the form field's suffix slot, on the shared `.et-input-clear` / `.et-input-picker-trigger` classes. `--et-select-arrow-size` is retired for `--et-form-field-affix-icon-size`.

### Minor Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`eca35a1`](https://github.com/ethlete-io/ethdk/commit/eca35a132ce08dd3f0fd65d42f8fb6775e3c81f3) Thanks [@github-actions](https://github.com/apps/github-actions)! - Avatar: `et-avatar-group` takes `maxVisible` and appends the `+N` avatar itself, and `et-avatar` is
  also an attribute selector, so an avatar that links somewhere is written as the link it is.

- [`38c44d1`](https://github.com/ethlete-io/ethdk/commit/38c44d18cd2e7f10f9ce0b4ebe2d60106bed6a36) Thanks [@TomTomB](https://github.com/TomTomB)! - Buttons: `tone` and `mutedUntilPressed` are replaced by `color="surface"` and `pressedColor`, so neutral toning is a color theme rather than a per-component override.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`1f72eb9`](https://github.com/ethlete-io/ethdk/commit/1f72eb9453b6b7726cfe312720299b913f5c565f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `provideColorPalette` - the labelled color themes an app offers a user to pick from. The scheduler's color field becomes a swatch picker when one is in scope, and stays a text box when none is.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`f926ca3`](https://github.com/ethlete-io/ethdk/commit/f926ca38c9167091f4803e5f8090c8b12d5559af) Thanks [@github-actions](https://github.com/apps/github-actions)! - Description list: add `variant` - `stacked` puts each term above its detail in one column, next to the default two-column `inline`.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`695c2e9`](https://github.com/ethlete-io/ethdk/commit/695c2e9d08f2e283816488938b446009acd4ad99) Thanks [@github-actions](https://github.com/apps/github-actions)! - Dropzone: the single-file preview's name bar slides out of the way on hover or focus, so the image can be checked unobstructed. It stays while uploading and on error.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`791d28d`](https://github.com/ethlete-io/ethdk/commit/791d28dda1c4cd6cc1ff436ee72d97d755e303a8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: a `warn()` schema rule puts a non-blocking advisory where an error would go - the field stays
  valid and submittable, an error still wins the slot, and the text theming and resolver mirror errors.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`21d559c`](https://github.com/ethlete-io/ethdk/commit/21d559c610e8f3b2ce6bec35ce9fc9de080ac71c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: `et-grid` is generic in the item payload, so `layoutChange` / `getSerializedState()` hand your
  own type back instead of `unknown`, and an `et-grid-item` span input now refines a registered type's
  constraints instead of being ignored.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`21d6e15`](https://github.com/ethlete-io/ethdk/commit/21d6e157000536e45ef9bb60e14b3863822049fe) Thanks [@github-actions](https://github.com/apps/github-actions)! - Progress steps: `orientation="vertical"` stacks the steps with a vertical connector, and writing a
  step as `<a et-progress-step>` or `<button et-progress-step>` makes it a real link or button with
  hover and focus treatment.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`695c2e9`](https://github.com/ethlete-io/ethdk/commit/695c2e9d08f2e283816488938b446009acd4ad99) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: the agenda draws connector lines between a parent appointment and its children, and the edit surface's sub-appointment list carries each child's start time and chain count.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`914ee7f`](https://github.com/ethlete-io/ethdk/commit/914ee7f7effbc6d6463903104a456fe9f1f9e062) Thanks [@github-actions](https://github.com/apps/github-actions)! - Tabs, nav tabs and the segmented button group's `tabs` variant read one shared tab scale now, so
  `sm`/`lg` tab bars and their overrides finally size correctly and a tabs row matches a real tab bar.

### Patch Changes

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`695c2e9`](https://github.com/ethlete-io/ethdk/commit/695c2e9d08f2e283816488938b446009acd4ad99) Thanks [@github-actions](https://github.com/apps/github-actions)! - Cascader: a reopened bottom sheet no longer shows two drag handles.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`695c2e9`](https://github.com/ethlete-io/ethdk/commit/695c2e9d08f2e283816488938b446009acd4ad99) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: warn in dev mode when an item's `layout` misses a configured breakpoint, instead of silently rendering it as a 1×1 item at the grid origin.

- [`e78525a`](https://github.com/ethlete-io/ethdk/commit/e78525ac32b3e2549b2dbef51886d4ac519beaa6) Thanks [@TomTomB](https://github.com/TomTomB)! - Password input: the default Caps Lock warning now reads `'Caps Lock might be on'`, since the state can lag a keystroke behind.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`e095163`](https://github.com/ethlete-io/ethdk/commit/e095163b7a10934f1a9909d7f5b19aaf7fdcaec9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Password input: switching Caps Lock off now clears the warning instead of leaving it up, since the Caps Lock key's own events report the pre-toggle state on macOS.

- [#3055](https://github.com/ethlete-io/ethdk/pull/3055) [`d35f376`](https://github.com/ethlete-io/ethdk/commit/d35f3765dbfea47acd78d6fb941b9f52384d7c0c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: `provideStreamConfig({ pipChromeComponent })` now defaults to `null` (meaning the built-in chrome) rather than to the component itself, which put a circular import between the stream config and the pip window.

## 1.0.0-next.43

### Minor Changes

- [`d9dada4`](https://github.com/ethlete-io/ethdk/commit/d9dada4189ece040a7b5c6423ad802228ace0e88) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: override an auth provider's access-token lifetime from the Auth tab, so the proactive refresh, the expiration warning and the logout behind them happen in seconds instead of hours.

- [#3054](https://github.com/ethlete-io/ethdk/pull/3054) [`9bd94f6`](https://github.com/ethlete-io/ethdk/commit/9bd94f62d01ff000c5e3e84c4f010bd109422e4c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: arm every designed mock in one click, and keep armed mocks or faults across a reload
  with two new Settings scopes.

- [#3054](https://github.com/ethlete-io/ethdk/pull/3054) [`3b0f1ea`](https://github.com/ethlete-io/ethdk/commit/3b0f1ea09f2539091a1f3da091f94cbd4e2cbec5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: export designed mocks as OpenAPI 3.1 - one route to the clipboard, or the whole library as
  one YAML or JSON document.

### Patch Changes

- [#3054](https://github.com/ethlete-io/ethdk/pull/3054) [`9bd94f6`](https://github.com/ethlete-io/ethdk/commit/9bd94f62d01ff000c5e3e84c4f010bd109422e4c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a folded query group can be collapsed again while it holds the selection, its rows
  name the component each consumer was created in, and dropdowns are readable on Windows.

## 1.0.0-next.42

### Major Changes

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`45512c8`](https://github.com/ethlete-io/ethdk/commit/45512c84cea8c6ef679a5443b0f8d66a53f54558) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query error now renders as an `et-banner` of `type="error"`, themed with `--et-banner-*` - the `--et-query-error-*` tokens are gone. Banner gains `[etBannerHeading]` / `[etBannerBody]` slots and a `liveRegion` role override.

### Minor Changes

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`fe17b44`](https://github.com/ethlete-io/ethdk/commit/fe17b449795f63d818a8abb4ab56ccacfd97d5b2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: add the `hexColor` and `rgbColor` signal-forms validators, so a color value that arrives from an API or a paste still has to meet the format `et-color-input` documents.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`0fa8026`](https://github.com/ethlete-io/ethdk/commit/0fa80264a9927890ff61697aba8e5b036798403f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the value explorer's copy button gains a menu for the key, the JSONPath and a `"key": value` fragment, and its tick now names which one landed.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`9df67e0`](https://github.com/ethlete-io/ethdk/commit/9df67e042bf1d1b8f6283dd5773133b5c8a0e4ce) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the panel can float over the page as a third dock — dragged, resized, and shovable off an edge to park with a grab strip showing. A blocked pop-up now says so and offers the float.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`5c0f540`](https://github.com/ethlete-io/ethdk/commit/5c0f5409e022d1bd4629e3f8dac0c09c4f80c0bb) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the panel's position moved into a layout menu, which gains left and top docks alongside bottom, right, float and pop out.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`5c0f540`](https://github.com/ethlete-io/ethdk/commit/5c0f5409e022d1bd4629e3f8dac0c09c4f80c0bb) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: an opt-in tree toggle groups the Queries list by route path, folding single-child chains and heading only the segments that actually branch.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`d3f1b2b`](https://github.com/ethlete-io/ethdk/commit/d3f1b2b8d3c2a6a0e68013ba130bd833ac72d7fe) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a "Keep across reloads" toggle stores armed response overrides in `sessionStorage` and replays them on the next load, announcing in a banner what came back and what matched no query.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`8a73cca`](https://github.com/ethlete-io/ethdk/commit/8a73cca2049b40c2205481d1193af28977c0d959) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: every menu is now the SDK's `et-menu`, and they all work inside the popped-out panel.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`a4a373d`](https://github.com/ethlete-io/ethdk/commit/a4a373d94100fc738bc16d1bf96ef5d682b326ae) Thanks [@github-actions](https://github.com/apps/github-actions)! - Number input: drag a stepper button sideways to scrub the value, and hold `Shift`, `Alt` or press `PageUp`/`PageDown` to step by 10x, a tenth or 100x.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`7785405`](https://github.com/ethlete-io/ethdk/commit/77854057ae224fd07c3d6bd9f86aa7fc2e8147d4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Progress steps: `state` gains `success`, `warning` and `error` - a step that finished with an outcome, each with its own icon and the app's matching semantic color theme.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`f426563`](https://github.com/ethlete-io/ethdk/commit/f4265630749f162d097b147da55256e8bfa056ad) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: an About tab reporting the loaded `@ethlete/*` and Angular versions plus `provideQueryDevtools({ about })`, mirrored on `window.ethlete` and in the session export.

- [`908f35a`](https://github.com/ethlete-io/ethdk/commit/908f35a7a68445467cfe6fe60393f9dc9b140503) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: design a mock's body in the value explorer, and seed it from your API description via
  `provideQueryDevtools({ schema })`.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`d14fcf0`](https://github.com/ethlete-io/ethdk/commit/d14fcf0cf4537bca49aee2671b178c1af0df5d39) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a Mocks tab that answers a route with a designed response instead of sending the request, and copies that route back out as a typed query definition.

- [`5feb1dc`](https://github.com/ethlete-io/ethdk/commit/5feb1dcc9b5428357faba170acfce1101fa29150) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: copy a query's whole armed override set and paste it onto another, and edit response
  values with `Set to null`, `Empty this array`, `Paste as new item` and delete.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`a51e919`](https://github.com/ethlete-io/ethdk/commit/a51e9192e7166ea22ff3cfcabdbd96ae4cb94e54) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a Settings panel behind the header's gear - a storage scope per kind of panel state, runtime limits, a reset, and every panel-wide switch in one place.

### Patch Changes

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`54352ad`](https://github.com/ethlete-io/ethdk/commit/54352ad162140782688715faa68c1aa3d2498b81) Thanks [@github-actions](https://github.com/apps/github-actions)! - Accordion: hovering a header now also brightens its hairline and lifts the hint and chevron to full strength, paced by the new `--et-accordion-color-duration`, and hover states no longer stick on touch.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`9b555f7`](https://github.com/ethlete-io/ethdk/commit/9b555f7fe66caa7a0d609cceeef7310b2404414a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: clicking a Queries-list group header now collapses it even while it holds the selected query.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`025d940`](https://github.com/ethlete-io/ethdk/commit/025d940706cc02fc89da5299b125fe70378392a5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: calmer chrome - the query action row collapses twelve buttons into an Execute group plus **Copy** and **Override** menus, empty status chips are dropped, and controls grow for touch.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`cb3a72a`](https://github.com/ethlete-io/ethdk/commit/cb3a72acf9e9ab82e8e42677462001eea7fcc963) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: **⌖ Locate** now finds a query created in a host element that renders no box of its own (`display: contents`) instead of reporting **Not on screen**.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`b8aa839`](https://github.com/ethlete-io/ethdk/commit/b8aa8391304657b543e00142df20a518a6e946b3) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: reloading the app now closes a pop-out window instead of leaving a dead panel open in it.

- [#3053](https://github.com/ethlete-io/ethdk/pull/3053) [`b8b5268`](https://github.com/ethlete-io/ethdk/commit/b8b5268d245535dfdb9c81321867d71b561291ba) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: tapping a control no longer leaves it lit until something else is tapped, controls a hover would reveal are always visible on touch, and a sticky toolbar sticks flush to the top.

## 1.0.0-next.41

### Minor Changes

- [#3050](https://github.com/ethlete-io/ethdk/pull/3050) [`a2da930`](https://github.com/ethlete-io/ethdk/commit/a2da9302a9ca7b45d7e7a9a64d50bafae5853ba1) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: swipe left/right to step the visible period (`etSchedulerSwipeNavigation`), and at narrow
  container widths Today collapses to an icon button while toolbar actions become floating FABs.

- [`9587953`](https://github.com/ethlete-io/ethdk/commit/9587953cdcf598fb18674a077d2dbf74e50d2b81) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: `pickOnly` now works in multi mode - the panel stays open for repeated picks - and never
  displays a value of its own, so a bound `value` only checks the picked options in the panel.

### Patch Changes

- [#3050](https://github.com/ethlete-io/ethdk/pull/3050) [`08c4a5a`](https://github.com/ethlete-io/ethdk/commit/08c4a5ae90b60bca140a02595b55e6ebdbc0064e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: `anchoredDialogOverlayStrategy` scales from a fixed `0.85` around its origin's center instead of starting at the origin's own width and height.

- [`70a0602`](https://github.com/ethlete-io/ethdk/commit/70a06025c2f919bd1582b2d0adbf80b21a25696a) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the auth tab shows which tab performs the automatic token refresh and how many are in the election, instead of only echoing back how the feature was configured.

- [`4fe5656`](https://github.com/ethlete-io/ethdk/commit/4fe5656a01b6842cb1717828b94f19b22fbb04fe) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the query detail header gets a copy button for its route - the absolute URL of the last request, or the rendered route for a query that has not run yet.

- [#3050](https://github.com/ethlete-io/ethdk/pull/3050) [`f523fb2`](https://github.com/ethlete-io/ethdk/commit/f523fb26476071293c05bef13b685f5154f76533) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: **Execute** replays the args the panel is showing, so a query executed imperatively no longer replays empty - a function route used to throw `ET003` into the app's `ErrorHandler`.

- [`7d6bc17`](https://github.com/ethlete-io/ethdk/commit/7d6bc17bb50c4977af27c6d81edb72e7e7882266) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: `HttpHeaders`, `FormData`, `Map`, `Set`, `Date`, `File` and `Blob` args render their real contents instead of private fields or `{}`, and the args editor preserves the ones JSON cannot carry rather than replaying them empty.

- [`397fd34`](https://github.com/ethlete-io/ethdk/commit/397fd34e5ba574c7ebc089b3d0f65900d397db4b) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the Queries list folds rows it would otherwise repeat - one query used by several consumers is now one line with an instance count, expandable to reach each consumer.

- [`33e705b`](https://github.com/ethlete-io/ethdk/commit/33e705bfb989ec80e245b4bd9e2091c57cd337b8) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: **Forget** shows only while the **Gone** chip is lit, drops exactly the tombstones the list is showing, and is styled as the destructive action it is instead of as a filter clear. `clearQueryDevtoolsTombstones()` takes optional ids.

- [`467dcb9`](https://github.com/ethlete-io/ethdk/commit/467dcb9f0986d6a169dbcba94c02fdf942326854) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the History tab folds the older runs whose bodies are gone, and the response diff gains Older/Newer controls, so re-picking a pair no longer means scrolling back up to the runs table.

- [`ef6a5e4`](https://github.com/ethlete-io/ethdk/commit/ef6a5e4ce9f574da45cf02790dde7259fe23237e) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: a Locate action on the selected query scrolls the element it was created in into view and outlines it - Inspect run backwards.

- [`b8ffa81`](https://github.com/ethlete-io/ethdk/commit/b8ffa814b1f855f4f5d6b9b73bdef9b3004c0f60) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the Queries list carries a last-run time per row and sorts by it, newest first by default, with a control beside the search box that reverses the direction.

- [`5013381`](https://github.com/ethlete-io/ethdk/commit/5013381569abba69cc291846789f0ef78510628c) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: an `initialItems` update that only changes an item's `data` now reaches the grid instead of
  being dropped.

- [`0bc0d7f`](https://github.com/ethlete-io/ethdk/commit/0bc0d7f51b2fd38daefad41b8fcf0109f6393dcc) Thanks [@TomTomB](https://github.com/TomTomB)! - Split the query devtools stylesheet across the components that own its classes, so a
  consumer only pays for the tabs it opens.

- [#3050](https://github.com/ethlete-io/ethdk/pull/3050) [`b32ef3f`](https://github.com/ethlete-io/ethdk/commit/b32ef3fdb05d4b34c553dc18b59aa9253ee24b21) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: clicking empty grid now creates an appointment - an hour from the clicked time on the week and day views, an all-day one on the month view.

- [#3050](https://github.com/ethlete-io/ethdk/pull/3050) [`6af0e52`](https://github.com/ethlete-io/ethdk/commit/6af0e52baacd5bae6c63824f612591ac2be81d55) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: the drag-to-create surface now opens centered over the range you drew - its first week row if it wraps - and clicking that range closes it instead of reopening it.

- [#3050](https://github.com/ethlete-io/ethdk/pull/3050) [`2d44597`](https://github.com/ethlete-io/ethdk/commit/2d44597f07b165a83c19f049a022c4247a8e3eb1) Thanks [@github-actions](https://github.com/apps/github-actions)! - Slider and rating now drag on `dragGestureFrom`, so a gesture the browser takes away reverts
  instead of committing. `dragEnded` carries the release position.

## 1.0.0-next.40

### Major Changes

- [`ead8ba8`](https://github.com/ethlete-io/ethdk/commit/ead8ba8075abb0f7629acca37413adf5240f62e5) Thanks [@TomTomB](https://github.com/TomTomB)! - A control's own clear, picker-trigger and reveal buttons now render in the form field's suffix slot, so a busy spinner can no longer displace them. **Breaking:** those per-control classes are now `.et-input-clear` / `.et-input-picker-trigger`.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`0e1f7d0`](https://github.com/ethlete-io/ethdk/commit/0e1f7d0176c92574bb10fbd9e7942bd2ae97eded) Thanks [@github-actions](https://github.com/apps/github-actions)! - The `variant="card"` chrome on `et-radio`, `et-checkbox-option` and `et-choice-field` is now one lazily-injected stylesheet with one token set. **Breaking:** `--et-radio-card-*`, `--et-checkbox-option-card-*` and `--et-choice-field-card-*` are now `--et-selection-card-*`.

### Minor Changes

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`86659a1`](https://github.com/ethlete-io/ethdk/commit/86659a1adc3f90c8d8ce4b76ceb955c55aa61b62) Thanks [@github-actions](https://github.com/apps/github-actions)! - Auth: a tab receiving synced tokens now retries its failed queries, a cross-tab logout is a real logout, and the remember-me cookie survives startup. Query devtools: a failed run keeps its status and body.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`c0963d5`](https://github.com/ethlete-io/ethdk/commit/c0963d501ad34962e1583434b22c8304b1e309e6) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-badge` gained a `size` input (`sm | md | lg`) and an icon slot: an element carrying `etIcon` is sized to the badge's font size, on either side of the label via `iconAlignment`.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`9fc5ec5`](https://github.com/ethlete-io/ethdk/commit/9fc5ec5ace959b50402c0688bebf721d69bd4945) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools overrides: type a custom value or paste a copied subtree as a replayed rule, and presets (including the new long-word one) now generate a varied sample per arm instead of one frozen value.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`1d181d7`](https://github.com/ethlete-io/ethdk/commit/1d181d7ecec575a2cae17f42f6914b70b4dd95ac) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a destroyed query stays readable as a tombstone - a muted row the **Gone** chip narrows to - and the repository emits `entry-destroyed` so the panel can say why a cache entry disappeared.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`484b21e`](https://github.com/ethlete-io/ethdk/commit/484b21e0b1f54aa7b8e11e9389a7cb630c6b1326) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-kbd`, which renders a shortcut such as `keys="mod+k"` as keycaps using the current platform's glyphs - `⌘ K` on Apple, `Ctrl K` elsewhere. Pin it with the `platform` input or `KBD_PLATFORM`.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`7081567`](https://github.com/ethlete-io/ethdk/commit/7081567496b2a6416b6c1a74223a278c6a2a2c1d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: pick both ends of a response diff instead of only comparing a run against its predecessor, and raise how many bodies are kept with `provideQueryDevtools({ responseHistory })`.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`08756c3`](https://github.com/ethlete-io/ethdk/commit/08756c32e228a1d68dd0077e1aa535bd6c3f3096) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a **★** on each Queries row pins that endpoint to the top of the list. Pinning sorts rather than filters, so it composes with the client, search and status chips.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`7a63efd`](https://github.com/ethlete-io/ethdk/commit/7a63efdb435e93a046620eb689a4e983463ef743) Thanks [@github-actions](https://github.com/apps/github-actions)! - Drag empty scheduler grid to create an appointment, on week, day and month. The
  edit surface now opens anchored to what it came from, and full screen below `md`.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`52787ae`](https://github.com/ethlete-io/ethdk/commit/52787ae88fc5a0d3770a330979575e9424769530) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-timeline` / `et-timeline-item` for chronological event lists, with a per-item time slot, projectable markers and a `color` scope.

### Patch Changes

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`6bd6057`](https://github.com/ethlete-io/ethdk/commit/6bd6057398465ecd24a2f187321934e12430d127) Thanks [@github-actions](https://github.com/apps/github-actions)! - New `injectFileDownload()` and `createObjectUrlHandle()` in core replace four hand-rolled object URLs. The query devtools exports now append their anchor before clicking it, which Firefox ignored.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`b81d4bc`](https://github.com/ethlete-io/ethdk/commit/b81d4bc621be7457e2b653b5f6e2fb58a6bf27dc) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form field counter: the over-limit state now comes from the control's own `maxLength` validator instead of a second length check that could disagree with it.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`eb404b8`](https://github.com/ethlete-io/ethdk/commit/eb404b86d7239c6133b69ad0b194bbfe15dc690b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the Queries list hides destroyed queries until the **Gone** chip is on,
  and a ★ pin now holds one row instead of every query of the same endpoint.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`5953f17`](https://github.com/ethlete-io/ethdk/commit/5953f17d601ab0ba2445ef2a3824ad51b09a0b48) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: below `md` the panel stacks its panes instead of demanding ~48rem of side-by-side width, its header strips scroll rather than wrap, and both resize dividers work by touch.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`c984b8c`](https://github.com/ethlete-io/ethdk/commit/c984b8cc7e71596b0218763f90e1411d3afaf3e4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a `null`/`undefined` value can now be overridden instead of showing an empty menu, and **Reset** appears only where something is armed and clears the whole subtree.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`6c95aa0`](https://github.com/ethlete-io/ethdk/commit/6c95aa00bb0df0aa4c3638453a35c4f14a9364eb) Thanks [@github-actions](https://github.com/apps/github-actions)! - A gesture the browser takes away mid-drag now emits `dragCancelled` / `resizeCancelled` instead of `dragEnded`. Grid moves and resizes, table column reorder and column resize revert instead of committing a drop the user never made.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`1528f13`](https://github.com/ethlete-io/ethdk/commit/1528f130ba0b32e07be26f8510393ae39b3a1588) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: a `minColSpan` wider than the breakpoint's column count now degrades to full width instead of overflowing, edges that cannot resize grow no handles, clearing `initialItems` clears the grid, and reconciling that input no longer emits `layoutChange`.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`cd6c59b`](https://github.com/ethlete-io/ethdk/commit/cd6c59b9a962e6a72d68115a2a8e993a5565362a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Let a grid widget type its own `data` input. `GridComponentRegistration` and
  `GridItemActionsComponent` now accept a read-only `Signal<TData>`, so a component
  declaring `input.required<MyPayload>()` registers without a cast - `InputSignal<T>`
  is invariant in `T` and made every registration need one.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`5008c81`](https://github.com/ethlete-io/ethdk/commit/5008c81d726021d078e87ecb37cfb1d5d4eee6cb) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid resize strips grow into the gap - a 14px target at the default gap, with the marker unmoved - via the new `--et-resize-handles-outset`. Touch sizes now key on `any-pointer: coarse`, so a touchscreen laptop gets them too.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`21778c8`](https://github.com/ethlete-io/ethdk/commit/21778c8509f534e5999bc84bf0e91ecbcb2f70b9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Notification: at `480px` and below the stack spans both edges and toasts fill it, instead of a `300px`-minimum card floating in a corner - which overflowed a `320px` viewport outright.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`776e692`](https://github.com/ethlete-io/ethdk/commit/776e69230b990721b9b32e216b1faf4589093013) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the full-screen open and close animation now clones the origin at the size it renders at, so a badge squeezed by a grid cell or a percentage-sized element no longer jumps to its intrinsic size.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`3ae42ba`](https://github.com/ethlete-io/ethdk/commit/3ae42bafe2f6d0d458aefb3a91a79ea7bad91d49) Thanks [@github-actions](https://github.com/apps/github-actions)! - Password input: the Caps Lock warning icon carries a tooltip, so sighted users get the same explanation screen readers already got.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`317e4e3`](https://github.com/ethlete-io/ethdk/commit/317e4e34bc8672e095b718ac98d87ea06324f7a1) Thanks [@github-actions](https://github.com/apps/github-actions)! - Tree: a disabled row no longer lights up on hover or press in a multi selectable tree, and now mutes as a whole the way a disabled select option does.

- [#3048](https://github.com/ethlete-io/ethdk/pull/3048) [`5b1966c`](https://github.com/ethlete-io/ethdk/commit/5b1966ca33480cc16ee39d072eea31a7424e4de6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Tree: a multi selectable tree states selection with a leading check box instead of a fill, so adjacent selected rows no longer paint one continuous accent slab. Single select is unchanged.

## 1.0.0-next.39

### Minor Changes

- [#3047](https://github.com/ethlete-io/ethdk/pull/3047) [`2c547b3`](https://github.com/ethlete-io/ethdk/commit/2c547b310423174e7d7a413dd2507efe873e8cff) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add a `component` generator that scaffolds a domain following the three-tier architecture: `nx g @ethlete/components:component <name>`.

- [#3047](https://github.com/ethlete-io/ethdk/pull/3047) [`167cc7f`](https://github.com/ethlete-io/ethdk/commit/167cc7f26f06b3580858bb5c1d40bea5abc95973) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the tree domain: `et-tree` and headless `[etTree]` render a hierarchy as an ARIA tree, loading each branch through a `TreeDataSource` the first time it expands.

## 1.0.0-next.38

### Major Changes

- [#3046](https://github.com/ethlete-io/ethdk/pull/3046) [`6daa97a`](https://github.com/ethlete-io/ethdk/commit/6daa97a94f5cd762aa815ef85cc9c72a2a8d0694) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: the public surface is now the data types and enums only - the internal engine builders (`createBracket`, relation and base map generators) are no longer exported.

### Minor Changes

- [#3046](https://github.com/ethlete-io/ethdk/pull/3046) [`5b94adc`](https://github.com/ethlete-io/ethdk/commit/5b94adc97abb32555fb462fad71cbe27fc733a4a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select and cascader panels now stay below the field with a shorter list instead of flipping
  above it or sliding over it, via the new anchored-overlay `minAvailableSpace` option.

- [`9448256`](https://github.com/ethlete-io/ethdk/commit/9448256314db8240a0d86d957e58cf4333ff3123) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `et-divider`, a horizontal or vertical rule between groups of content, and lay the rich text editor's selection toolbar out as the row it always declared.

- [`2ce2411`](https://github.com/ethlete-io/ethdk/commit/2ce24117ec7e344de5bde08dec22ec1db17b1831) Thanks [@TomTomB](https://github.com/TomTomB)! - Add `et-toolbar` / `[etToolbar]`: a bar of controls sharing one tab stop, navigated with the arrow keys per the ARIA toolbar pattern. The rich text editor's toolbar now uses it.

- [#3046](https://github.com/ethlete-io/ethdk/pull/3046) [`c91868e`](https://github.com/ethlete-io/ethdk/commit/c91868e248a91a7bde59f5938acdc12e5108da8c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Root menus now stay below their trigger with a shorter scrollable list instead of flipping
  above it, and no longer overflow the viewport when they do not fit.

- [#3046](https://github.com/ethlete-io/ethdk/pull/3046) [`50fc4c2`](https://github.com/ethlete-io/ethdk/commit/50fc4c262b281578640f24a3cc6e29c3f1620d4f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: clicking an appointment now opens `<et-scheduler-edit-surface>`, a composable edit dialog (title, time range, location, description, color, add/delete sub-appointment) - see `appointmentSave`/`appointmentsDelete` on `<et-scheduler>`.

- [#3046](https://github.com/ethlete-io/ethdk/pull/3046) [`f7bde9f`](https://github.com/ethlete-io/ethdk/commit/f7bde9fe5e8f762bda125c161a11491536e0b1f9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: the toolbar and time grid are now mobile-friendly, and a built-in toolbar action (`etSchedulerActionAddAppointment`) creates new top-level appointments.

### Patch Changes

- [#3046](https://github.com/ethlete-io/ethdk/pull/3046) [`1230b98`](https://github.com/ethlete-io/ethdk/commit/1230b98f783ca4aa878abcdc7567e18060cc4758) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: the edit surface truncates a long title instead of pushing its header actions out of
  view, and its footer buttons align to the right.

## 1.0.0-next.37

### Minor Changes

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`ab09f53`](https://github.com/ethlete-io/ethdk/commit/ab09f53cc5cc5ceb9cf6f40d2be4136402fd04c5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-avatar` - a user/entity image with an initials or icon fallback - and `et-avatar-group` for overlapping stacks.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`ccb363d`](https://github.com/ethlete-io/ethdk/commit/ccb363dc9acd7e69fe88710976ade68f59805b26) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-badge`, a small non-interactive pill for a status word or a count, with `filled` / `tonal` / `outline` variants and color-theme support.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`78b385a`](https://github.com/ethlete-io/ethdk/commit/78b385a32206e324ef42a4d4664379bf49880a44) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-banner`, a static, dismissible page/section message with semantic info/success/warning/error coloring.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`2f52660`](https://github.com/ethlete-io/ethdk/commit/2f526609b087314f9b2128b70837b27a57a385c2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-card`, a generic content container with `elevated` / `outlined` / `filled` variants and surface-theme support.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`bd910e7`](https://github.com/ethlete-io/ethdk/commit/bd910e7bcf7c17e5fd050a2b640ea082bc8defdc) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `etCopyButton`, a clipboard-copy directive with icon-swap feedback you compose onto any button.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`abaac73`](https://github.com/ethlete-io/ethdk/commit/abaac73230e1e19c92840265a2cbc399233a622c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-description-list`, styling a native `<dl>` into grid-paired term/detail rows.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`be7b602`](https://github.com/ethlete-io/ethdk/commit/be7b602ce2c478255ba953ff87db5d60497248f8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-empty-state` - an icon/heading/description/action placeholder for a section or page with nothing to show.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`317a8c4`](https://github.com/ethlete-io/ethdk/commit/317a8c46664388e72d4e332f6e57a64e0951aa9d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `et-progress-steps` / `et-progress-step`, a wizard step indicator numbered and connected purely in CSS.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`8a9ccc7`](https://github.com/ethlete-io/ethdk/commit/8a9ccc7810936f925ac1d5b974f63606c8e6e742) Thanks [@github-actions](https://github.com/apps/github-actions)! - Dropzone: `createDropzoneUpload()` / `createV2DropzoneUpload()` accept an optional `delete` config that fires a request when an already-uploaded or existing entry is removed, with new `deleteSucceed` / `deleteFail` outputs.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`c38c726`](https://github.com/ethlete-io/ethdk/commit/c38c726b9fd3a2b8f06b248a969d85a5fe2fcc39) Thanks [@github-actions](https://github.com/apps/github-actions)! - Icon button and FAB: per-size dimensions are now public `--et-icon-button-*` / `--et-fab-*` custom properties, so a consumer can rescale them without overriding `width`/`height` or private variables.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`b2ac74b`](https://github.com/ethlete-io/ethdk/commit/b2ac74b0fad22ba656d7b2028d19dd25f06e57d8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: add a per-value override menu to the response explorer - edit, duplicate, or resize a value so it keeps reapplying on every future fetch - plus a "tampered" badge for overrides and armed faults.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`300079e`](https://github.com/ethlete-io/ethdk/commit/300079e48648c77e0e0e9fbfc575d5c065309197) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: appointment badges are now built from composable adornments (title, time range, color dot, location, sub-appointment count) - disable any one with its own `etSchedulerBadge*` config on `<et-scheduler>`. `Appointment` gains an optional `location` field.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`39b259e`](https://github.com/ethlete-io/ethdk/commit/39b259e654ca394635e7cd3078fb0a2ec5484edd) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `<et-scheduler>`, a composable appointment calendar with month, week, day and agenda views, multi-day all-day appointments that span the days they cover, and appointments that nest into sub-appointment chains via `parentId`.

### Patch Changes

- [`4957a0a`](https://github.com/ethlete-io/ethdk/commit/4957a0ac4e5b7bfff9b9215d22c6e009f7b3cfa0) Thanks [@TomTomB](https://github.com/TomTomB)! - Bracket: fix a padded section's stored height being short by its own top padding.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`c2aa8d8`](https://github.com/ethlete-io/ethdk/commit/c2aa8d83eacf8983b1b01b2993d5395b7029fc83) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date range input: a `schema.start`/`schema.end` validation error now reaches the field's error area, instead of only turning the frame invalid with no message.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`a7a47e3`](https://github.com/ethlete-io/ethdk/commit/a7a47e38b7bfa35d39f9b121fccda470b26c6bea) Thanks [@github-actions](https://github.com/apps/github-actions)! - Dropzone: preview images no longer crop to fill the box, so non-square uploads like logos aren't cut off.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`1fb193c`](https://github.com/ethlete-io/ethdk/commit/1fb193c0e494357cbfb8a6a6428643b114c177f8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay dialogs, sheets and full-screen dialogs now skip their enter/leave motion under `prefers-reduced-motion`, matching tooltip/menu/toggletip. Fixes the animation lifecycle getting stuck under reduced motion, which could leave focus and `overlayRef.afterOpened()` never firing.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`8a4f849`](https://github.com/ethlete-io/ethdk/commit/8a4f849d38ded09adebf5728d8876efa61dd22ed) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: split the monolithic panel into a component per tab, with no behavior change.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`68db0b8`](https://github.com/ethlete-io/ethdk/commit/68db0b8ad57cf8f8bf77d06fa6f9e2ba23c1215d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Structural `RuntimeError`s (e.g. "must be placed inside X") now log the offending host element via `console.error`, so you can click straight to it in devtools instead of guessing from the message alone.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`f2c5f47`](https://github.com/ethlete-io/ethdk/commit/f2c5f474185efe300cccf0a7b5c724ee39b499a6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scheduler: align the time-grid appointment dot to the title's first line instead of overlapping it, drop the redundant dot on month-view pills, and hide the all-day row when nothing is in it.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`f2f000e`](https://github.com/ethlete-io/ethdk/commit/f2f000efb1b0ef4ec6b748a3fe909df3b481faa2) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select`: `etSelectOptionTemplate` keeps extra option fields typed when you also bind its `[options]` to the same array passed to `[options]` on the select.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`cbd6424`](https://github.com/ethlete-io/ethdk/commit/cbd6424900753a2bb2f6f7a49ece53c7b31c4a8b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select: track the windowed data-driven option rows by value instead of by identity, so a virtual
  scroll that replaces the whole rendered window no longer logs Angular's NG0956 track-expression
  warning in dev mode.

- [#3045](https://github.com/ethlete-io/ethdk/pull/3045) [`087060c`](https://github.com/ethlete-io/ethdk/commit/087060ce8868ed541b2543aabec3670debfb8162) Thanks [@github-actions](https://github.com/apps/github-actions)! - Slider, rating and table row-selection now meet the ≥44px touch-target guideline on their interactive hit areas, up from 28px/24px/32px.

## 1.0.0-next.36

### Major Changes

- [`9bb5c45`](https://github.com/ethlete-io/ethdk/commit/9bb5c45e2c046361346ad98c333911bc88014853) Thanks [@TomTomB](https://github.com/TomTomB)! - The rich text editor's heading, quote, code-block, link and autoformat behaviour is now opt-in - add
  `provideRichTextEditorDefaultTools()` to keep the previous toolbar. Saves 3.5 kB gz without it.

- [`4ecdca9`](https://github.com/ethlete-io/ethdk/commit/4ecdca98bc55635346e887a3ff3910cd5695dd7d) Thanks [@TomTomB](https://github.com/TomTomB)! - The rich text editor's selection toolbar is now opt-in - add `provideRichTextEditorFloatingToolbar()`
  to keep it. Saves 15 kB gz without it, the whole overlay runtime.

- [`c6abde8`](https://github.com/ethlete-io/ethdk/commit/c6abde82663554e0430ab0433f43077cd81b39ee) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: grouped column headers are now the opt-in `etTableGroupHeaders` (`TABLE_GROUP_HEADERS_IMPORTS`), taking 440 B gz off a plain table. A column's `group` has no effect without it, and `hasGroups()` / `headerGroups()` move from the table onto the feature.

- [`6ca8d50`](https://github.com/ethlete-io/ethdk/commit/6ca8d50322b4f8df546fd27ddc08b7c84c168d4c) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: row expansion is now the opt-in `etTableRowExpansion` (`TABLE_ROW_EXPANSION_IMPORTS`), taking 2,026 B gz off a plain table. `expandableRow` and `expandedKeys` move onto the feature, and expanded rows serialize under `state().features.expansion` (`v: 3`).

- [`7f5568d`](https://github.com/ethlete-io/ethdk/commit/7f5568dea20329c1da2c9cd7e91192ad53e65eab) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: loading placeholders are now the opt-in `etTableSkeleton` (`TABLE_SKELETON_IMPORTS`), taking 999 B gz off a plain table. `loadingRows` becomes its `rows` option and `etTableCellSkeleton` moves into its imports array.

- [`5abbc0f`](https://github.com/ethlete-io/ethdk/commit/5abbc0f470066e98fa21c3df9aab5f8a74e5cefc) Thanks [@TomTomB](https://github.com/TomTomB)! - Table: sticky columns are now the opt-in `etTableStickyColumns` (`TABLE_STICKY_COLUMNS_IMPORTS`), taking 386 B gz off a plain table and its measuring off every resize. A column's `sticky` renders unpinned without it.

### Minor Changes

- [`fb32936`](https://github.com/ethlete-io/ethdk/commit/fb32936caa749895fc77348a6213d0d3ab6bd056) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: copy a query as cURL, download the whole session as JSON, dock the panel right or pop it into its own window, and read duration/size in Events plus sizes, values and evict-all in Cache.

- [`fb32936`](https://github.com/ethlete-io/ethdk/commit/fb32936caa749895fc77348a6213d0d3ab6bd056) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the divider between a tab's two panes is now draggable on both axes, and empty tabs fold into a "More" menu.

### Patch Changes

- [`2d63cd3`](https://github.com/ethlete-io/ethdk/commit/2d63cd390a03f36eec59b7862728ed9f952a7596) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the value explorer's and the Timeline's styles now load with those views, so the panel's stylesheet fits Angular's default `anyComponentStyle` budget again.

- [`a50a6a0`](https://github.com/ethlete-io/ethdk/commit/a50a6a01e722746cf74fe6181d2da301912528ab) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix `HttpRequestLoadingProgressState.speed`, which reported 1000x the actual rate (and
  `Infinity` on a stalled or re-executed request), and show it in the query devtools.

## 1.0.0-next.35

### Minor Changes

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`156659d`](https://github.com/ethlete-io/ethdk/commit/156659de868ff8a66f9b0b6acbb59c637979500d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: count what every query cost - how often it refreshed, how many refreshes reached
  the network, and how much payload they moved - as activity tiles per query plus totals per client.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`ebc94d4`](https://github.com/ethlete-io/ethdk/commit/ebc94d456176f350a02a29d8b23c1c6fbb573cd5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: an Events row's request cell is now a button that opens the query it came from.

- [`6c6213b`](https://github.com/ethlete-io/ethdk/commit/6c6213b48f8e5c5ccf0fcb526dd50884e768fb82) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: the Timeline and Forms tabs open a query in a split-view drawer, the timeline's right-hand columns align, and an armed fault is called out on every tab.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`ebc94d4`](https://github.com/ethlete-io/ethdk/commit/ebc94d456176f350a02a29d8b23c1c6fbb573cd5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: a new **Faults** tab arms real request failures per query client - latency before
  every attempt, fail-the-next-N, fail-N%, and the response status - resolved per attempt inside the
  pipeline, so the retry policy re-rolls it.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`156659d`](https://github.com/ethlete-io/ethdk/commit/156659de868ff8a66f9b0b6acbb59c637979500d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: list every query, auth and client feature with the options it was configured with,
  not just its name.

- [`6c6213b`](https://github.com/ethlete-io/ethdk/commit/6c6213b48f8e5c5ccf0fcb526dd50884e768fb82) Thanks [@TomTomB](https://github.com/TomTomB)! - Query devtools: add a **Forms** tab covering `createQueryForm` - its fields, URL params and the query it drives - and log each invalidation with every query it refetched.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`9f5f9ec`](https://github.com/ethlete-io/ethdk/commit/9f5f9ecc64a0290f753b9979e2667fbe3de238a0) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the Insomnia export now includes the auth provider's token refresh, and secure
  requests read their bearer token out of its response instead of shipping one that goes stale.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`19ef607`](https://github.com/ethlete-io/ethdk/commit/19ef607750afbf57b3d390300fb1bc2600c58459) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: narrow the Queries list with a filter box matching method, resolved route and path,
  plus **Failing** / **Loading** / **Stale** / **Idle** chips. Every tab now carries its entry count
  and a badge for failing entries.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`156659d`](https://github.com/ethlete-io/ethdk/commit/156659de868ff8a66f9b0b6acbb59c637979500d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: list queries with their path params filled in from args (`/post/12` instead of
  `/post/:param`), and export requests as an Insomnia v4 collection.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`8b665a3`](https://github.com/ethlete-io/ethdk/commit/8b665a39bccf09e51fac34c6d05b9b9d2793d4e5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Surface retries and transfer progress in the query devtools: `request.subtle.attempts()` and
  `request.subtle.retryState()` report what a retry policy is doing, and the panel shows backoff
  countdowns, attempt counts and a progress bar for `reportProgress` requests.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`37a74ae`](https://github.com/ethlete-io/ethdk/commit/37a74aec9c149a00f493894a75499c7e86d83cf7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Record what a query did per run: its last 25 runs land on the devtools stats handle, feeding a new
  **Timeline** tab that draws every request on one axis and a **History** section that diffs responses.

### Patch Changes

- [`89b72c5`](https://github.com/ethlete-io/ethdk/commit/89b72c5c67b6eb7f7efec05f711e54ec5dd8601b) Thanks [@TomTomB](https://github.com/TomTomB)! - `et-input` accepts a nullable bound field - binding one (e.g. the query form's search field) used to throw once the label floated.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`156659d`](https://github.com/ethlete-io/ethdk/commit/156659de868ff8a66f9b0b6acbb59c637979500d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: inspect mode now shows that it is armed and how to cancel it, and GraphQL documents
  get a copy button. Also fixes a query row that jumped when it went stale.

- [#3043](https://github.com/ethlete-io/ethdk/pull/3043) [`8d3471c`](https://github.com/ethlete-io/ethdk/commit/8d3471ca2153e1585d3cdad1c0c8c7b8f5ed220a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: the value explorer folds containers over 100 entries into collapsed slices, so a
  5000-item response opens with 50 rows instead of 5000.

## 1.0.0-next.34

### Minor Changes

- [#3042](https://github.com/ethlete-io/ethdk/pull/3042) [`7b11b23`](https://github.com/ethlete-io/ethdk/commit/7b11b232f02bcdf65ea0cfc84ac26794218214dd) Thanks [@github-actions](https://github.com/apps/github-actions)! - Picture: add a `fit` input for filling a box the host defines, plus `naturalSize()` /
  `naturalAspectRatio()` signals and a `{ naturalWidth, naturalHeight }` payload on `imgLoad`. Load state now
  also resets when only `sources` changes.

- [#3042](https://github.com/ethlete-io/ethdk/pull/3042) [`296eabc`](https://github.com/ethlete-io/ethdk/commit/296eabc064f9a6a531abd51646ce72e1c5495ab7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: add the missing imports arrays - `CHECKBOX_GROUP_IMPORTS`, `RADIO_GROUP_IMPORTS`,
  `SEGMENTED_BUTTON_IMPORTS`, `SELECTION_LIST_IMPORTS` (the headless engine) and
  `DESCRIPTION_IMPORTS`, so the selection-list groups and `et-description` no longer need
  their components imported one by one.

- [#3042](https://github.com/ethlete-io/ethdk/pull/3042) [`cba8794`](https://github.com/ethlete-io/ethdk/commit/cba87945369f4cfdf7300127653fd5632ab3592b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Spinner: add a `color` input that paints the strokes with a color theme's primary. Unset, the spinner
  keeps inheriting `currentColor` as before.

## 1.0.0-next.33

### Major Changes

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`df55f32`](https://github.com/ethlete-io/ethdk/commit/df55f3237f2fc7234165b83ed564df78060ea133) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: layouts are opt-in values you register, so an app bundles only the renderers it draws with.
  Pass factories to `provideBracketConfig({ layouts })` or the `layouts` input on either host. The
  `layout` input and `BracketConfig.swiss` are gone - mirrored is a layout, swiss options live on
  `swissBracketLayout()` - and an unregistered mode throws `ET3413`.

  ```diff
  - provideBracketConfig({ swiss: { colors } });
  - <et-bracket layout="mirrored" [source]="source()" />
  + provideBracketConfig({ layouts: [mirroredSingleEliminationBracketLayout(), swissBracketLayout({ colors })] });
  + <et-bracket [source]="source()" />
  ```

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`beec05f`](https://github.com/ethlete-io/ethdk/commit/beec05f70be10fcded054d825320d93f96c6b414) Thanks [@github-actions](https://github.com/apps/github-actions)! - Breadcrumb: collapsing the trail is now opt-in. Import `BREADCRUMB_COLLAPSE_IMPORTS` and apply `etBreadcrumbCollapse` to the breadcrumb, the outlet, or any ancestor to keep the overflow control; without it the trail is clipped and the toggletip's overlay runtime stays out of your bundle.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`beec05f`](https://github.com/ethlete-io/ethdk/commit/beec05f70be10fcded054d825320d93f96c6b414) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: `GridDebugComponent` moved out of `GRID_IMPORTS` into `GRID_DEBUG_IMPORTS`, so the development-only overlay no longer ships in production bundles. Import that barrel where you use `<et-grid-debug />`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`caa8c92`](https://github.com/ethlete-io/ethdk/commit/caa8c9286c6e25c298995525e91159e9ad04cd0d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query error: labels default to English only — the German status tables are no longer bundled or auto-selected by locale. Keep the old behavior with `provideQueryErrorLabels(queryErrorLabelsForLocale)` (or `GERMAN_QUERY_ERROR_LABELS`); the `migrate-query-error-labels` generator finds affected sites.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`6be90f2`](https://github.com/ethlete-io/ethdk/commit/6be90f28518a969607202ebc8d99365f3506bae5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the link editor popover is opt-in via `provideRichTextEditorLinkEditor()` — without
  it the `link` tool falls back to `prompt()`. Run
  `nx g @ethlete/components:migrate-rich-text-editor-link-editor` to find affected editors.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`a0e5424`](https://github.com/ethlete-io/ethdk/commit/a0e5424be31a2031b566e4cdf150275ab7bd4f37) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the `'heading'` block-style menu is now an opt-in tool -
  `provideRichTextEditorHeadingTool()`, like the align/table/image tools. It stays in the default toolbar,
  so that call is all it takes; without it no block-style control renders (Markdown `#` autoformat is
  unaffected). It was the only default tool needing the menu system, worth 8.5 kB gz to every editor.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`2c0d3c9`](https://github.com/ethlete-io/ethdk/commit/2c0d3c9f78bfceed19dd49b01f934d1cfebc83c2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scrollable: the buttons, dots, drag and snap are now opt-in directives on the `<et-scrollable>` itself, so a plain track no longer bundles them. Replace `renderButtons` / `buttonPosition` / `stickyButtons` with `[etScrollableButtons]` (`SCROLLABLE_NAVIGATION_IMPORTS`), `renderNavigation` with `etScrollableNavigation`, `snap` / `snapOrigin` / `cursorDragScroll` with `etScrollableSnap` / `etScrollableDrag` (`SCROLLABLE_DRAG_IMPORTS`), and `darkenNonIntersectingItems` with `etScrollableDarken` (`SCROLLABLE_DARKEN_IMPORTS`). `ScrollableMasksDirective` / `ScrollableButtonsDirective` / `ScrollableNavigationDirective` are renamed to `…Component`; the directive names now belong to the opt-ins.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`beec05f`](https://github.com/ethlete-io/ethdk/commit/beec05f70be10fcded054d825320d93f96c6b414) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: `STREAM_IMPORTS` now holds only the shared consent, loading, error and slot pieces. Add the barrel of each platform you embed (`STREAM_YOUTUBE_IMPORTS`, `STREAM_TWITCH_IMPORTS`, … `STREAM_SOOP_IMPORTS`) and `STREAM_PIP_IMPORTS` for picture-in-picture - or `STREAM_ALL_IMPORTS` to keep the old contents. A YouTube-only app saves ~5 kB gz.

### Minor Changes

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`1f528bd`](https://github.com/ethlete-io/ethdk/commit/1f528bd629b9c4f1cc5160d87745ad927a02203d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Accordion: add `preventCloseLast` to the group - the header can no longer collapse the last open
  panel, so paired with `autoCloseOthers` the group behaves like a radio set. `close()`, `closeAll()`
  and `[(isOpen)]` still collapse it.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`c796f12`](https://github.com/ethlete-io/ethdk/commit/c796f123982b7e93dc756b9926f8b5e6e1788a41) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: add `density="compact"` - narrower columns, and match cards that answer with a code and a
  score, for a full bracket inside an article column. Layout inputs are now overrides on top of it, so
  an unbound input resolves through the preset instead of a fixed default.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`568e937`](https://github.com/ethlete-io/ethdk/commit/568e9379c7ba2d4176f29d7a7939d4c5a7e1bfa7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: `mirroredDoubleEliminationBracketLayout()` draws double elimination as stacked winners and
  losers blocks, each folded around its own centre on a shared middle column, with the deciding rounds
  chained below. Also fixes hovering a card lighting the wrong participant's journey, and a mirrored
  bracket drawing its way-back connectors backwards.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`35d4f03`](https://github.com/ethlete-io/ethdk/commit/35d4f03e81d7f916e7057d8525372176fa463f27) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: journeys are now per participant. Hovering one side of a card lights that participant's path
  alone and marks where they went out, and `[(focusedParticipantId)]` pins a path for touch and keyboard
  - driven from a control of yours, cleared with `Escape`. Match cards mark each side with
    `data-participant-id`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`a8dd388`](https://github.com/ethlete-io/ethdk/commit/a8dd388e8846cf6a19cac7645d8f9b24207401d3) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: add `<et-bracket-rounds-list>`, the same source drawn as a vertical round-by-round list
  (sectioned for double elimination), plus `bracketNaturalWidth()` / `bracketFitsWidth()` to decide when
  to swap to it on a narrow screen.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`fba7ed8`](https://github.com/ethlete-io/ethdk/commit/fba7ed852d7f4bfb7791cce13f5062b8c4fa4c59) Thanks [@github-actions](https://github.com/apps/github-actions)! - Breadcrumb: add `etBreadcrumbSeo` (`BREADCRUMB_SEO_IMPORTS`) - opt-in `schema.org` **BreadcrumbList**
  JSON-LD, which is what earns a site the breadcrumb line in a search result. Crumbs state their own
  `name` and `url` through new inputs on `etBreadcrumbItemTemplate`; loading and unnamed crumbs are
  skipped, and the last crumb needs no `url`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`06a6ba2`](https://github.com/ethlete-io/ethdk/commit/06a6ba2889124267c05f0b0432578aaa2c8794ca) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar: `comparisonStart` / `comparisonEnd` band a compared period under the selection - the
  analytics "vs. the previous 30 days" pattern - and the date range input forwards them. It is
  presentation only, so picking never writes to it. Cells expose `data-comparison-band`, and
  comparisons band at the calendar's `precision`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`d97e71a`](https://github.com/ethlete-io/ethdk/commit/d97e71a9e0ee6f53cb71c2b05f8dae64fcdb92a5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar: the header is replaceable, and now moves with the grid it names.

  - `ng-template etCalendarHeader` projected into `et-calendar` renders instead of the default header,
    with the headless directive as its context; `et-calendar` also exposes it as `headless`.
  - The label travels with the rows, the caret no longer swings with the label's width, grids crossfade
    rather than cut, and the picker's bottom sheet keeps one height.
  - Fixed: the calendar warned NG0956 twice per navigation in dev.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`8ff5062`](https://github.com/ethlete-io/ethdk/commit/8ff506229e889dda5389404b187b517fe6158baa) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar: `monthsShown` renders several months side by side - the classic two-month range picker,
  where a range spanning the turn of a month is one gesture. The span shares one keyboard scope, one
  selection and a band that runs through the seam, and stepping moves by a single month. Headless:
  `monthPages()`. The date inputs deliberately don't forward it.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`8692c2c`](https://github.com/ethlete-io/ethdk/commit/8692c2c8d00577ec701e9fa50ac2487be8a54ef0) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar: `mode="multiple"` selects a set of unrelated dates into its own `multipleValue` model
  (`Date[]`, kept ascending). Picking a date again removes it, nothing bands or previews, and the grid
  is `aria-multiselectable`. It composes with `precision`. The date inputs have no equivalent - their
  value is one wire string.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`35c463c`](https://github.com/ethlete-io/ethdk/commit/35c463cc17c2a7ea1e0bfa791371c10cf92fbe18) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar and date inputs: `precision` (`'day' | 'month' | 'year'`) makes them month or year pickers -
  picking in that grid writes the value (the start of the unit) instead of drilling further, and ranges
  compare, band and complete at the same unit. On `et-date-input` / `et-date-range-input` it also
  derives the text format, so `displayFormat` now defaults to `null`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`c41beec`](https://github.com/ethlete-io/ethdk/commit/c41beec18d6920eb154ffc84a1393fd0b18ea8b6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar: `rangeSelectionStrategy` decides what a pick means in `range` mode, forwarded by the date
  range input. A strategy is two pure functions of `(date, currentRange)` - `select`, and the optional
  `preview` for what to band on hover. `createWeekRangeStrategy({ weekStartsOn })` snaps to whole weeks
  and `createFixedLengthRangeStrategy({ days })` makes every pick a complete span.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`d5012e1`](https://github.com/ethlete-io/ethdk/commit/d5012e10ce81514c62eb1c1b76784a30a6d6b6de) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `startAt` to the calendar: where an empty calendar opens and which day takes the
  initial roving focus (e.g. next month for a booking form). A selection or an explicit
  `activeMonth` still wins over it, and without any of the three the calendar opens on
  today. `et-date-input`, `et-date-range-input` and `et-date-time-input` forward it to
  their picker calendar.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`d9b05fc`](https://github.com/ethlete-io/ethdk/commit/d9b05fc92ca568a4d57e0711a6a0bab6db3a0e0c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar: the header label is a button that zooms the day grid out to months and then years, and
  picking one drills back in; `startView` decides where it opens, forwarded by the three date inputs. A
  coarse pick only navigates, reported as `monthSelect` / `yearSelect`. `min`/`max`/`dateFilter` and the
  keyboard model reach every view, and the new `dateClass` puts classes of your own on any cell.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`cbd68e0`](https://github.com/ethlete-io/ethdk/commit/cbd68e0287667b9cfb9b3138d0508378fffea0b5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Calendar: `weekNumbers` renders a leading week-number column on the day grid, forwarded by the date,
  date-range and date-time inputs. The numbering is localized rather than always ISO, so it names the
  rows actually on screen. Each number is its row's `rowheader`, and `--et-calendar-week-number-size`
  sizes the column.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`62b03f9`](https://github.com/ethlete-io/ethdk/commit/62b03f937274d68139be12df3778ce7d316600ea) Thanks [@github-actions](https://github.com/apps/github-actions)! - Carousel & Scrollable: much smoother swiping on a phone - 85% less style recalculation and 88% less
  paint with `transition="wipe"`, and no observer work during a scroll. Snapping is native CSS scroll
  snap (`ScrollableDirective.suspendSnap()` holds it off while something writes an offset itself), and
  the built-in transitions run as composited keyframes. New `transition="custom"` fills
  `--et-carousel-slide-progress` without applying an effect, for CSS of your own; new
  `--et-carousel-wipe-dim-color`; `signalElementChildren` / `signalElementScrollState` take a
  `mutations` option to narrow their observers.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`cb1c5b0`](https://github.com/ethlete-io/ethdk/commit/cb1c5b0ee5a4cf735b8846364fd06bed77b59018) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: the placeholder cards are now real - compact `et-match-card` cells, a hero final card with a
  champion line, heading round headers (`roundHeaderLevel`) and a labelled continue cell. They need
  `provideBracketConfig({ matchNormalizer })` to read your match data (`normalizeEthleteBracketMatch` ships
  for Ethlete feeds), and `finalColumnWidth` / `finalMatchHeight` now default to `360` / `200` to fit them.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`9057738`](https://github.com/ethlete-io/ethdk/commit/90577383b754af4789f034cee5199bf2b56f8203) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the match domain behind `MATCH_CARD_IMPORTS`: `<et-match-card>` (one card, three container-query layouts -
  dense row, featured card, wide row; `size` pins one; put it on an `<a>` to make the whole card the link),
  `<et-match-participant>`, the headless `etMatchCard` directive with its score/meta/game-score parts,
  `provideMatchLabels()`, and `normalizeEthleteMatch()` - cards take a `NormalizedMatch`, so any backend maps in
  with a plain adapter.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`0d30c38`](https://github.com/ethlete-io/ethdk/commit/0d30c385db868f70c92f2b0db670e99dd645177d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Match card: live scores now roll when they change - old value out, new value in, with a flash on the side
  that scored - plus a `scoreChange` output carrying the side and delta for your own effects. Only while the
  match is live, never on first render, instant under reduced motion; `animateScoreChanges` turns it off.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`fd8ac2f`](https://github.com/ethlete-io/ethdk/commit/fd8ac2f546fd8ac8cab61b249dccf01089b4b18e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the standings table behind `STANDINGS_IMPORTS`: `<et-standings>` draws a real `<table>` from
  `NormalizedStandingRow`s (any backend maps in; `normalizeEthletePlacement` ships for Ethlete feeds), bands
  position `zones` in your own color themes and draws their legend from the same config, drops columns rather
  than scrolling on narrow widths, and can single out one row.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`26a987f`](https://github.com/ethlete-io/ethdk/commit/26a987f9972d25156dfec4753170b06b79b74793) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form field: an `[etIcon]` projected into `[etInputPrefix]` / `[etInputSuffix]` is now sized by the
  shell (`--et-form-field-affix-icon-size`, `16px`) - no size class needed, matching the other
  in-field icons.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`d97e71a`](https://github.com/ethlete-io/ethdk/commit/d97e71a9e0ee6f53cb71c2b05f8dae64fcdb92a5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Icon: add a `label` input. An icon stays `aria-hidden` by default - it usually repeats the text beside
  it - but a lone status glyph is the content, and `label` turns the host into a named `role="img"` so
  the meaning survives for a screen reader.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`d97e71a`](https://github.com/ethlete-io/ethdk/commit/d97e71a9e0ee6f53cb71c2b05f8dae64fcdb92a5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: add `loop` (default `true`, the current behaviour). Turn it off and the arrow keys stop at the
  ends instead of wrapping, which reads better in a long menu. A menu with a search field is
  unaffected - its ends hand focus back to the field either way.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`f0082cd`](https://github.com/ethlete-io/ethdk/commit/f0082cd3a6e3ed20fc534b02d25e260f4e1d8600) Thanks [@github-actions](https://github.com/apps/github-actions)! - Notification upgrades:

  - `manager.promise(work, { loading, success, error })` follows a promise, an observable or an `@ethlete/query` query in one toast.
  - `id` in the config replaces a live notification instead of stacking a duplicate.
  - Status icons (overridable per notification via `icon`), plus `secondaryAction` for an action pair.
  - Swipe/flick a notification away; opt out with `swipeToDismiss: false`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`0e08bc2`](https://github.com/ethlete-io/ethdk/commit/0e08bc23450a58635dfae906d9fefc96f18a359b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Pagination: add `<et-page-size-select>` (`PAGE_SIZE_SELECT_IMPORTS`) - the "Items per page" control
  that completes the Material-style controls row beside a compact paginator. A native `<select>`, so it
  pulls in nothing; a separate component, because page size is the app's state rather than the
  paginator's. Changing the size deliberately does not reset the page. Two new label keys, `pageSize`
  and `pageSizeOption`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`38b3c2b`](https://github.com/ethlete-io/ethdk/commit/38b3c2b6c1f6f54efcac63f4f991b682dfd1485e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: undo/redo over the Markdown value, replacing the browser's native
  `contenteditable` history (which could restore states the value never had). Ctrl/Cmd+Z, Ctrl+Y and
  the platform's own undo all route into it, plus new `'undo'` / `'redo'` toolbar tools that lead the
  default toolbar. Typing goes back word by word; a paste, autoformat or tool rewrite in one step.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`1c7ad03`](https://github.com/ethlete-io/ethdk/commit/1c7ad0373cf8cf7845be1d3337bbafe71eec9fc0) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: `provideRichTextEditorImageTool({ upload })` embeds images as `![alt](url)` - pick,
  paste or drop a file, uploaded by your handler (a promise, an observable, or a `createDropzoneUpload`
  config for real progress), with a placeholder that never touches the value and a popover for alt text.
  Tool definitions gained `paste`, `drop` and `click` content hooks; without the tool, pasted image
  files are refused rather than becoming `blob:` URLs in the value.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`48fbe62`](https://github.com/ethlete-io/ethdk/commit/48fbe62fefe815a59d1b41e6fbc7055c88537e58) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: pasted text that spells a token out - `#First name`, the trigger char plus an
  item's label or id - comes back as a real chip, for HTML and plain-text clipboards alike (opt out with
  `parsePastedTokens="false"`). A trigger with a static `items` list no longer needs `resolveItem` to
  render chip labels.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`7e444d6`](https://github.com/ethlete-io/ethdk/commit/7e444d6d11f65b00ae22b9d0f9d553ff3b45b733) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: block quote and fenced code block tools (`'blockquote'` / `'codeBlock'`, also
  typed as `> ` / ` ``` `), both in the default toolbar. Quotes nest with Tab/Shift+Tab; a code block
  holds literal text, so the marks that can't serialize inside one disable themselves. `htmlToMarkdown`
  / `markdownToHtml` now round-trip nested quotes (`>>`).

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`b3673f3`](https://github.com/ethlete-io/ethdk/commit/b3673f32015277a57be0887e43775869dd72b3ca) Thanks [@github-actions](https://github.com/apps/github-actions)! - Selection lists: add `<et-checkbox-group-select-all>`, the prebuilt tri-state select-all row that had
  to be hand-rolled until now - a real `role="checkbox"` with `aria-checked="mixed"`, taking its text
  from the new shared `selectAll` form label. Also `orientation="horizontal"` on `et-checkbox-group` and
  `et-radio-group`, flowing the options in a wrapping row.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`84a8d00`](https://github.com/ethlete-io/ethdk/commit/84a8d005838660be71cac158769f659c670465e8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Sliders: `orientation="vertical"` turns `et-slider` / `et-range-slider` (and the headless `etSlider` /
  `etRangeSlider`) into a bottom→up slider, its length set by `--et-slider-vertical-size`. `marks`
  renders ticks on the track - `true` for one per `step`, or an array of `{ value, label? }` stops - and
  `snapToMarks` moves commits and keyboard steps mark to mark instead of along the `step` grid.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`41c2683`](https://github.com/ethlete-io/ethdk/commit/41c268395cfa476024a3ef4680eacda0660cd9ba) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: add CSV export - `TABLE_CSV_EXPORT_IMPORTS` / `etTableCsvExport` for a button of your own, or
  `injectTableCsvExport()` / `tableToCsv()` from TypeScript. It writes the visible columns and the
  table's own rows by default (`exportValue` gives a column its text form), `rows` also takes a provider
  function, `tableCsvRowsFromPages({ fetchPage })` walks a paginated endpoint, and `file` saves a CSV the
  server built instead. A server-paginated table that would silently export a single page is a dev-mode
  error (`ET3506`) unless you pass `partial: true`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`e5ffd4d`](https://github.com/ethlete-io/ethdk/commit/e5ffd4d031e956e12b0d32f9cdee9dc843832c32) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: add `etTableInlineEdit` (`TABLE_INLINE_EDIT_IMPORTS`) - inline cell editing. Mark a column
  `editable` and give it an `etTableCellEdit` template, whose context is the draft as a signal-forms
  field, so any of the library's controls is an editor with a plain `[formField]` binding. Double-click
  or `Enter` starts, `Enter` saves, `Escape` restores, `Tab` saves and moves on; `cellCommit` reports
  `{ row, column, previous, next }` and the mutation stays yours.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`040bbb3`](https://github.com/ethlete-io/ethdk/commit/040bbb3559b2c1705b2358a5c7158f491dce4a67) Thanks [@github-actions](https://github.com/apps/github-actions)! - Table: add `etTableKeyboardNav` (`TABLE_KEYBOARD_NAV_IMPORTS`) - arrow-key navigation over the body's
  cells following the ARIA grid pattern, with Home/End, Ctrl+Home/End and PageUp/PageDown. The body
  becomes a single tab stop; `Enter` drills into a cell's own control and `Escape` comes back out.
  Composes with virtual scrolling.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`255bebc`](https://github.com/ethlete-io/ethdk/commit/255bebcad8a0db468093784c300a865d90c224e7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Time picker: `etTimePicker` / `et-time-picker` take `min`, `max` and `timeFilter`, matching the
  calendar's bounds, and `et-time-input` / `et-date-time-input` forward them as `minTime` / `maxTime` /
  `timeFilter`. Availability is per column - an hour is disabled only when no minute inside it is
  selectable - unselectable options stay in place and the keyboard steps over them, and picking a part
  moves the finer ones to the first value that works, including the hour behind an AM/PM pick.

### Patch Changes

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`6c9d38d`](https://github.com/ethlete-io/ethdk/commit/6c9d38d7e6b41586d7c9abb3296e5f45ccc3767c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay runtime: build anchored strategies with `anchoredOverlayPosition({ referenceElement, … })`
  instead of a `{ kind: 'anchored', … }` literal - it is what pulls `@floating-ui/dom` in, so apps
  that only center dialogs no longer bundle it (~7 kB gz). `autoResize`, `autoHide`,
  `autoCloseIfReferenceHidden` and arrows additionally need `enableAnchoredOverlayPositionExtras()`.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`d97e71a`](https://github.com/ethlete-io/ethdk/commit/d97e71a9e0ee6f53cb71c2b05f8dae64fcdb92a5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Fix `<et-carousel>` autoplaying by default: `autoplay` is the component's own input now and defaults
  to `false`, which is what it always documented. Add `autoplay` to a carousel that should play. On the
  headless directive, read the new `isEnabled()` for what is in effect.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`833b579`](https://github.com/ethlete-io/ethdk/commit/833b579f42f413ae715e792d5aa40e14d3e95513) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-match-participant` now takes an attribute form (`<a et-match-participant>` / `<button …>`), so a player or
  team card can be the click target itself. On an interactive host it names itself after the participant - the
  link would otherwise read "FC Berlin emblem FC Berlin" - takes the shared focus ring, and drops the button
  chrome. `et-match-card` already worked this way.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`8609171`](https://github.com/ethlete-io/ethdk/commit/8609171a498982cdde8b7ce2c600cf4d42031016) Thanks [@github-actions](https://github.com/apps/github-actions)! - Docs: add a Sport UI recipes guide - the today's-matches rail (built on `et-scrollable`, which is why
  `et-match-list` was never shipped as a component) plus competition, team, player and nation cards, each with
  a live story to copy from.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`8f0e42a`](https://github.com/ethlete-io/ethdk/commit/8f0e42a8a436aba6a061968bfd6dc144344a896f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form field: the text-field shell, rich-text, textarea, hint and counter CSS now ships with the
  control that uses it, so a field holding only a checkbox, switch or slider no longer pulls the
  whole form-field stylesheet. No API change; chrome renders as before.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`2c0d3c9`](https://github.com/ethlete-io/ethdk/commit/2c0d3c9f78bfceed19dd49b01f934d1cfebc83c2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Choice field's card variant, the carousel autoplay chrome and the cascader's bottom-sheet
  presentation now inject their CSS only once that feature is actually used.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`353777b`](https://github.com/ethlete-io/ethdk/commit/353777bb56e42ad1c02058a2ccf694f69c94b025) Thanks [@github-actions](https://github.com/apps/github-actions)! - Mark build-tooling peer dependencies (`vite`, `typescript`, `ts-morph`, `@nx/devkit`, `@analogjs/*`) and feature-scoped runtime peers (`date-fns` in components) as optional via `peerDependenciesMeta`. They are only needed when running the Nx generators or using the date/time components - consumers no longer have to install them just to use the libraries.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`95c3d2f`](https://github.com/ethlete-io/ethdk/commit/95c3d2f096180119ed21937d5c41ed62a7b050e6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: `--et-overlay-body-padding-block` now reserves real space at the end of a scrolling body. Its end value used to be swallowed by the scroll container, leaving the last child's border and focus ring clipped against the divider once scrolled to the bottom.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`f59128f`](https://github.com/ethlete-io/ethdk/commit/f59128f23932f647f2653d2ee804cd474011915f) Thanks [@github-actions](https://github.com/apps/github-actions)! - `createOverlayUnsavedChangesGuard` stops vetoing closes once its tracker was abandoned (a logout), so the overlay closes instead of prompting over a page the user is being redirected away from. It also inherits the tracker's tab guard - the `beforeunload` lock is on by default, with the title marker / blink / favicon / badge extras available through the `tab` option.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`2c0d3c9`](https://github.com/ethlete-io/ethdk/commit/2c0d3c9f78bfceed19dd49b01f934d1cfebc83c2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the default enter/leave animation CSS now ships with the strategy that uses it
  (`stylesComponent` on the breakpoint config), so an app only bundles the animations for the overlay
  kinds it opens. Overlays that hand-roll a layout `containerClass` instead of using a built-in
  strategy must now provide their own animation CSS.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`8b13854`](https://github.com/ethlete-io/ethdk/commit/8b13854aa079196c84fc08da0aee685f728a441d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query client: multi-tab sync and response persistence are opt-in `features` instead of defaults - the
  `multiTabSync` / `persistence` client options are gone and a client without the features ships neither
  engine. Migrate with `nx g @ethlete/query:migrate-query-client-features`.

  - `withMultiTabSync()` shares reads, polls a cache key in one tab for all of them and refreshes the
    others after a mutation; per-query `multiTabSync: false` keeps a query tab-local.
  - `withQueryPersistence()` keeps public reads in IndexedDB, so a reload renders the last known data
    while it revalidates. Secure responses need an explicit opt-in and are removed on logout.
  - `refreshQueriesInUse()` also refreshes GraphQL queries transported over POST; devtools gain Sync
    and Disk columns.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`8422cf0`](https://github.com/ethlete-io/ethdk/commit/8422cf09bcb4cdc07621d7a495004d8bf5e37d2c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: fix escaping a code block that sits flush against the start or end of the content,
  where there is no line to move to. ArrowUp off the first line and ArrowDown off the last now create
  the paragraph they would move to, and a second Enter on the empty last line leaves the block.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`1c7ad03`](https://github.com/ethlete-io/ethdk/commit/1c7ad0373cf8cf7845be1d3337bbafe71eec9fc0) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the docked (touch) toolbar no longer leaves a gap between itself and the on-screen
  keyboard, however much the browser over-reports the keyboard's height, and it re-checks while the
  keyboard is up in case a viewport event never arrives. A page that opted into the VirtualKeyboard API
  gets `env(keyboard-inset-height)` instead of the measurement.

- [#3041](https://github.com/ethlete-io/ethdk/pull/3041) [`42ec970`](https://github.com/ethlete-io/ethdk/commit/42ec970d6963bb5a3aa3af4e207ef2cac801c915) Thanks [@github-actions](https://github.com/apps/github-actions)! - DI: `createProvider` / `createRootProvider` / `createStaticProvider` / `createStaticRootProvider` /
  `createLabels` are replaced by `defineProvider` & co., which return a definition you read with
  `toProvideFn` / `toInjectFn` / `toToken`; `createQueryClient`, `createBearerAuthProvider` and
  `createWebSocketClient` return that definition instead of a tuple. Every `provideX` / `injectX` /
  token export keeps its name - run `nx g @ethlete/core:migrate-provider-shape` for your own call sites.
  Cuts the `@ethlete/components` import floor from 89.9 to 2.4 kB gz.

## 1.0.0-next.32

### Major Changes

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`e052061`](https://github.com/ethlete-io/ethdk/commit/e0520614647b784f19ad55a4d7f6df47acec154e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Localization: one mechanism for every string the library renders. `createLabels` (core) backs a
  `provide<Domain>Labels` / `inject<Domain>Labels` pair per domain - 22 of them, all locale-reactive and
  signal-shaped. See the [localization guide](https://ethlete-sdk-docs-next.web.app/components/localization).

  - New tokens make the rich text editor, stream, grid, loader, chip, calendar, time picker, dropzone,
    select, cascader, phone input, slider, date/time and notification strings overridable.
  - **Breaking:** `inject*Labels()` now returns a signal; the string fields left `StreamConsentConfig`,
    `StreamPlayerErrorConfig`, `PipSlotPlaceholderConfig`, `GridConfig` and `NotificationManagerConfig`
    (with their `transformer` hooks); per-instance label inputs default to `null` instead of English.
  - Fixes the PiP close/back buttons, which set an attribute literally named `attr.aria-label`.

### Minor Changes

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`57494e0`](https://github.com/ethlete-io/ethdk/commit/57494e0834708ef1d397829074e20e35bc5d8acd) Thanks [@github-actions](https://github.com/apps/github-actions)! - Boolean and numeric inputs now coerce attribute values via `booleanAttribute` / `numberAttribute`,
  so static values need no binding - `<et-tab disabled>`, `<et-textarea rows="6">`. Inputs where
  `null`/`undefined` means "unset" (the slider's `min`/`max`, the overlay's `hasBackdrop`, …) are
  deliberately left untransformed.

- [`2a5a48d`](https://github.com/ethlete-io/ethdk/commit/2a5a48dba8899d4b17b4139cf829ccb5d2daab4e) Thanks [@TomTomB](https://github.com/TomTomB)! - Card presets: `et-checkbox-option` now takes `variant="card"` too. Cards drop the tinted fill and
  follow the form-field frame for hover/press/focus, a selected card's border tracks the theme's
  interaction shades, `et-choice-field` cards are clickable across the whole panel including its
  border, and disabled / readonly cards no longer offer a pointer cursor. `et-form-field`'s hover
  treatment now follows the frame and label instead of the whole field, so the hint/counter row no
  longer triggers it.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`bc8aca7`](https://github.com/ethlete-io/ethdk/commit/bc8aca76900a47a3faed4ad2be2ce2ab7b70b27d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Filter overlay: new `provideFilterOverlay` / `injectFilterOverlay` - a filter panel that drafts the page's query
  form, reports how many results the draft would return on its submit button, and applies on submit or discards on
  dismiss. Replaces cdk's `FilterOverlayService`, rebuilt on signal forms and the current query client.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`4fb18af`](https://github.com/ethlete-io/ethdk/commit/4fb18afb4159a1a301c66c98029e7af1d46a02ad) Thanks [@github-actions](https://github.com/apps/github-actions)! - Floating action: new `etFloatingAction` family - a trigger that pins itself to the viewport corner once its place
  in the page scrolls away, and stands down once the region it acts on is gone. Replaces cdk's `rich-filter`, which
  rendered no filter UI; the three states are published as one `data-state`.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`c1db7e3`](https://github.com/ethlete-io/ethdk/commit/c1db7e3e8cf15d9dc192e51de699f0de8ee6fcbb) Thanks [@github-actions](https://github.com/apps/github-actions)! - Masonry: new `etMasonry` / `etMasonryItem` directives - column-balancing layout for variable-height cards.
  Items are measured continuously, so late-loading content reflows, and they keep their column when one grows.
  Gate infinite scroll on `isSettled()`.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`3a6d9ad`](https://github.com/ethlete-io/ethdk/commit/3a6d9ad0130b6141add15c2660c976b61455e5a4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Picture: new `et-picture` - responsive `<picture>` with art direction, format negotiation, `priority` hints,
  `aspectRatio` for reserving space, and `etPicturePlaceholder` / `etPictureError` slots. `providePictureConfig`
  prefixes relative srcsets per candidate.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`38f6af1`](https://github.com/ethlete-io/ethdk/commit/38f6af115c7a5107b268c44597dc5b871503d9d9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query error: new `<et-query-error>` and `[etQueryError]` - status title, message or violation list, and a retry
  button when the retry policy says it's worth offering. Themed with the app's `type: 'error'` theme, localized via
  `injectLocale()`, with `etQueryErrorTitle` / `etQueryErrorActions` slots. `legacyQueryErrorSource` bridges a V2
  query.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`d93dce3`](https://github.com/ethlete-io/ethdk/commit/d93dce3520e882a4cd4c6217d8a4cceedf74167c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form field: add `<et-counter />` - an `x / N` character counter in the support region, at the inline-end of the hint/error and persistent alongside them. It takes its limit from the bound field's schema `maxLength()`, or an explicit `[max]`, and counts array values (so it counts tags in an `et-tag-input`) via `lengthOf`.

  The field also shows a subtle busy spinner and `aria-busy` while an async validator is pending, plus `[busy]` on `et-form-field` to force it.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`38bb816`](https://github.com/ethlete-io/ethdk/commit/38bb8165006c4ebfba6a34623468ded140002188) Thanks [@github-actions](https://github.com/apps/github-actions)! - Card presets and a tabs variant: `et-radio` and `et-choice-field` take `variant="card"` (full-width clickable
  panel, label leading, selection on the border and label), and `et-segmented-button-group` takes `variant="tabs"` (underlined
  selection instead of a filled pill). Closes the last cdk parity gaps.

  `@ethlete/core` adds `injectRouterNavigationState<T>()` for reading the state a navigation was given.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`4624559`](https://github.com/ethlete-io/ethdk/commit/4624559c81ed9b6efffc539b8f1dd0db0556420c) Thanks [@github-actions](https://github.com/apps/github-actions)! - RTL and reduced-motion consistency pass:

  - Side sheets and the notification stack dock, animate and drag toward their logical inline edge under `dir="rtl"` - `dragToDismiss.direction` gains `'to-inline-start'` / `'to-inline-end'`.
  - `createFlipAnimation` and the PiP animations now skip to their end state under `prefers-reduced-motion`; `ignoreReducedMotion` opts out, and `matchesReducedMotion()` is exported for helpers with no injection context.
  - The full-screen overlay animation throws `ET1209` when it has no origin element, instead of a bare `Error`.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`fde4349`](https://github.com/ethlete-io/ethdk/commit/fde4349c2557d6f35d43e7eab09536a6b30524b4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overhaul the sheet drag-to-dismiss gesture. It runs on pointer events now (one path
  for touch, pen and mouse) and waits for 8px of travel along the dismiss axis before
  following the pointer, so a swipe starting on scrolled overlay content scrolls it
  instead of hijacking the sheet. Both the snap-back and the exit animate at the speed
  the pointer had when it let go, clamped to 100–350ms and skipped under
  `prefers-reduced-motion`. New `dragToDismiss.snapPoints` parks the sheet at fractions
  of its own size, advancing one point per flick and dismissing past the last one.

### Patch Changes

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`894c821`](https://github.com/ethlete-io/ethdk/commit/894c821c80df962f4c3cce986fb68f88ae26955d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Breadcrumb: leaner chrome - a neutral `et-ellipsis` overflow button that stays neutral while open, menu-like
  rows in its popover, and no flash of the full trail before it collapses on load. Adds
  `--et-breadcrumb-radius` and the `[data-toggletip-hug]` hook for content-width toggletips.

  Overlay: the anchored arrow now meets the pane's border line instead of leaving an unbordered wedge at its
  base - menus, tooltips and toggletips included.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`b06ed44`](https://github.com/ethlete-io/ethdk/commit/b06ed44db47a52d2a07a4d9a6b3bd3b04011decb) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the anchored arrow no longer rides into a pane's rounded corner on aligned placements or when a pane
  shifts near a viewport edge. `arrowPadding` now measures the arrow's actual base, so it means "how close the
  arrow may get to the corners" - tooltip and toggletip default to `20` (was `8`), a bare anchored strategy to
  `12` (was `4`).

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`bd369da`](https://github.com/ethlete-io/ethdk/commit/bd369da0b898096411d65c352220a26b48ec7a67) Thanks [@github-actions](https://github.com/apps/github-actions)! - Query devtools: arrays and objects in the value explorer now copy too - a container copies its
  subtree as JSON, a leaf copies the bare value. The toggle and close buttons print the platform's
  open/close shortcut, which now also fires on macOS. The inspect filter reads as a labelled banner
  instead of a bare pill.

- [#3040](https://github.com/ethlete-io/ethdk/pull/3040) [`b0a0869`](https://github.com/ethlete-io/ethdk/commit/b0a08696a0bcad9f120f8c58599b33d82d0fc61d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Touch quality fixes: the overlay body and scrollable containers keep overscroll to
  themselves (`overscroll-behavior: contain`), so reaching an end no longer scrolls the
  page behind them or triggers pull-to-refresh. Buttons, chips, menu items, select
  options, calendar cells and carousel dots drop the grey tap-highlight flash that
  duplicated their own `:active` state. Tooltips no longer open from touch input -
  mobile browsers synthesize a hover around a tap, which popped a tooltip nobody asked
  for - and any open tooltip now closes on a press elsewhere.

## 1.0.0-next.31

### Minor Changes

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`d1fd772`](https://github.com/ethlete-io/ethdk/commit/d1fd7724da894960f5fd9f2a7c1e4f82cdac8ab0) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the accordion: `<et-accordion>` (themed disclosure with an animated collapse,
  `isOpen` two-way model, `headingLevel`, label/hint slots and an `etAccordionContent`
  template for content created on first expand), `<et-accordion-group>`
  (`autoCloseOthers`, arrow-key navigation between headers) and the headless
  `etAccordion` / `etAccordionTrigger` / `etAccordionPanel` / `etAccordionGroup`
  directives behind `ACCORDION_IMPORTS`.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`13dfd58`](https://github.com/ethlete-io/ethdk/commit/13dfd58886672e1d8b9cfef81e98d29d74877d3c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the breadcrumb: `<et-breadcrumb>` with template-authored crumbs
  (`etBreadcrumbItemTemplate`, `loading` placeholders, `etBreadcrumbSeparator`) and measured overflow that
  moves the middle crumbs into a toggletip. In a routed app each view contributes only the crumbs it owns
  via `<ng-template etBreadcrumbSegment>`, and the single `<et-breadcrumb-outlet>` in the shell renders
  every registered segment as one trail - no view restates the path above it. Labels are localizable via
  `provideBreadcrumbLabels`.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`b4eb950`](https://github.com/ethlete-io/ethdk/commit/b4eb9506b3c3beff52670115bf50b26ea45b0c22) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add the carousel: `<et-carousel>` with slides from data plus an `etCarouselSlide` template, seamless looping,
  and scroll-driven slide transitions (`transition="dim"` / `"wipe"`, with `transitionDriver`). Also
  `slideAlign`, opt-in `autoplay` with per-slide `autoplayTimeFor`, and the headless `etCarousel` /
  `etCarouselAutoplay` / `etCarouselItem` / control directives behind `CAROUSEL_IMPORTS`.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`11ed986`](https://github.com/ethlete-io/ethdk/commit/11ed986c9391b6e4927312d166e8603bf1cefef8) Thanks [@github-actions](https://github.com/apps/github-actions)! - Bracket: new `<et-bracket>` tournament renderer - single/double-elimination and swiss layouts, SVG connectors, journey highlighting, and the `generateBracketDataForEthlete` data-source integration. Round-header, match, and continue cards render via barebones default components for now; supply custom cards through the `roundHeaderComponent` / `matchComponent` / `finalMatchComponent` / `continueComponent` inputs or `provideBracketConfig`.

  This is the `@ethlete/cdk` `NewBracket` renderer moved here and renamed (`et-new-bracket` → `et-bracket`, `NewBracket*` → `Bracket*`), with colors now driven by the `--et-bracket-line-color` / `--et-bracket-swiss-group-border-color` tokens (default `--et-surface-border-solid`) and errors thrown as `RuntimeError` (ET34xx). The fifa.gg integration was not ported. See the guide's "Migrating from @ethlete/cdk" section.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`875d22b`](https://github.com/ethlete-io/ethdk/commit/875d22bbde15669723cccf73c86983ad761c69b2) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add a **Pagination** component (`et-pagination`, `PAGINATION_IMPORTS`) - responsive, localizable, with optional crawlable page links and SEO head tags. See the [pagination guide](https://ethlete-sdk-docs-next.web.app/components/pagination).

- [`4b661b3`](https://github.com/ethlete-io/ethdk/commit/4b661b366682c18cf5371df03d3100d843146e5d) Thanks [@TomTomB](https://github.com/TomTomB)! - Scrollable: add `snapOrigin` for where a snapped child comes to rest (`'center'` suits a peeking layout), and
  stop snapping while a pointer is held on the track - it used to scroll out from under a paused drag.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`36c7119`](https://github.com/ethlete-io/ethdk/commit/36c71192663e3b491de0e7210887852012308c4e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add a **Skeleton** component (`et-skeleton`, `SKELETON_IMPORTS`) for loading placeholders - see the [skeleton guide](https://ethlete-sdk-docs-next.web.app/components/skeleton).

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`3c09f1d`](https://github.com/ethlete-io/ethdk/commit/3c09f1dd0c87ca366fe8f6c45fd138f4e8645402) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add a type-safe **Table** component (`et-table`, `TABLE_IMPORTS`) with a lean base and opt-in features for filtering, column menus, resizing, reordering, selection, virtual scrolling and state persistence - see the [table guide](https://ethlete-sdk-docs-next.web.app/components/table).

### Patch Changes

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`e813ca0`](https://github.com/ethlete-io/ethdk/commit/e813ca0f3b338533e5bccab2332344f7f1c8475c) Thanks [@github-actions](https://github.com/apps/github-actions)! - Checkbox: a checked or indeterminate box keeps its theme-coloured border on hover
  instead of flipping to the neutral interaction colour.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`22041b3`](https://github.com/ethlete-io/ethdk/commit/22041b348a3fec8535dd40eaba6fcc2559b83da9) Thanks [@github-actions](https://github.com/apps/github-actions)! - Checkbox: don't flash the focus ring on first render. The host's `opacity` /
  `outline-color` transitions were declared unconditionally as well as under
  `[data-can-animate]`, so on mount the outline colour animated from its resolved
  value and the ring briefly appeared. Transitions now live only under
  `[data-can-animate]` (added after the first render), so nothing animates on mount.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`25a6d1a`](https://github.com/ethlete-io/ethdk/commit/25a6d1a93c00f66683e73d6706872526896eab18) Thanks [@github-actions](https://github.com/apps/github-actions)! - Run effect teardown that never ran: tab panels, tab-bar triggers, notification stack items, PiP cells
  and the bracket's journey-highlight listeners returned a cleanup function from `effect()`, which Angular
  ignores. A removed tab panel stayed in the group's panel list (shifting later panels' indices), and the
  bracket's hover listeners stacked up per re-run and outlived the component.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`88cf3af`](https://github.com/ethlete-io/ethdk/commit/88cf3af9e61f9cc5ea7e6f547430246327c88f96) Thanks [@github-actions](https://github.com/apps/github-actions)! - Tighten `appearance="underline"` form fields: they no longer reserve the box height the
  `box`/`filled` skins need, so the rule sits directly under the value instead of at the
  bottom of a taller frame. A `size="sm"` field previously left ~12px of dead space
  between its value and the underline (most visible on a compact control like a table
  footer's page-size select) - that is now the field's own
  `--et-form-field-control-padding-block`, and the frame is content-height (27px instead of
  42px at `sm`).

  The floor is derived from the control's line box, so it scales with
  `--et-form-field-control-font-size` / `-line-height` / `-padding-block`, and a floating
  label still grows the frame past it. `box` and `filled` appearances are unchanged.

  Note this makes underline fields shorter on touch as well - reach for `box`/`filled` or
  a larger `size` where a full-size tap target matters more than density.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`dab7346`](https://github.com/ethlete-io/ethdk/commit/dab73460c22b47cf88106d3435cb95f78f756273) Thanks [@github-actions](https://github.com/apps/github-actions)! - Load more now dead-ends properly when the response can't state the end exactly: a page that comes back
  empty - or that repeats the previous page, which is what an API asked for a page past the end usually
  serves - is dropped instead of appended, and `hasMore` turns off regardless of `toHasMore`. Affects
  `selectOptionsFromQuery`, `selectOptionsFromV2Query` and both table rows adapters, so a load-more
  control no longer survives one page too long or duplicates the tail of the list.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`3ad95ef`](https://github.com/ethlete-io/ethdk/commit/3ad95efb56034c14f19e7c94d7137efb739f7b14) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: hovering an item no longer takes focus from an `etMenuSearch` field, so typing survives the pointer crossing the list.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`5616552`](https://github.com/ethlete-io/ethdk/commit/56165523fa96b6aef6feffd4302d73f18f094155) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: a checkbox/radio item's check, dot or custom icon is pinned to the item's trailing edge again.
  Its label's layout was declared in the plain menu item's stylesheet, which is only injected once that
  component renders - so in a menu built entirely from selection items (a filter menu, the rich text
  editor's heading and alignment menus) the label didn't grow and the indicator sat against the text
  instead of the edge.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`3151b7a`](https://github.com/ethlete-io/ethdk/commit/3151b7a253d14e38e22e20d67bf0191f141c144e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `ethlete/no-template-literal-before-inline-template`, and restructure the files it flagged.

  The Angular VS Code extension decides **client-side** whether the cursor sits inside an inline `template:` before it forwards completion, hover, go-to-definition or signature-help to the language server. That check (`isNotTypescriptOrSupportedDecoratorField`) walks the file with a bare `ts.createScanner()` loop, which cannot re-scan `}` as `TemplateMiddle`/`TemplateTail` - that needs the parser's `reScanTemplateToken()`. So the first template literal containing a `${…}` substitution desynchronises both the token stream and the brace counter, the scanner never recognises `template` `:` again, and every template request below it is dropped. The language server answers those requests correctly; the editor just never asks, so the template silently has no IntelliSense at all.

  The new rule reproduces that scanner verbatim, so it reports exactly the templates the extension would abandon - no heuristic. Twenty inline templates across `components`, `cdk` and the playground were affected, all of them behind a fixture or helper that happened to use an interpolated template literal. Story fixtures moved into sibling `*-storybook.data.ts` files; spec fixtures and in-class helpers that must stay above their component (because a later `@Component` references the class in `imports`) were rewritten without the interpolation.

  No public API changed - the `components` and `cdk` bumps are story/spec restructuring plus moving `signalVisibilityChangeClasses` below `RichFilterHostComponent` in the same module.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`d666dcd`](https://github.com/ethlete-io/ethdk/commit/d666dcd73055e0044a2e635eef15c24849cf1751) Thanks [@github-actions](https://github.com/apps/github-actions)! - Log the logout-wide secure unbind in the query devtools event log. A logout drops every secure cache
  entry at once; without a row of its own, the requests disappearing from the cache view had no visible
  cause.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`d85c58a`](https://github.com/ethlete-io/ethdk/commit/d85c58a84fc857847a03e4b736e27cd70fb5ee14) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the anchored link popover enters and leaves like a toggletip - a
  short fade plus a small nudge away from the selection it points at - instead of the
  anchored-dialog spring scale, which was far too much movement for a card sitting on
  top of the text being edited. The phone-sized top sheet is unchanged.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`76a6552`](https://github.com/ethlete-io/ethdk/commit/76a65521ed6efbb9a2e3e1b47099219d1ee0f750) Thanks [@github-actions](https://github.com/apps/github-actions)! - Scrollable: the edge masks and the previous/next buttons now actually appear. Their
  base `opacity: 0` was declared outside `@layer components`, so it beat the layered
  rules that reveal them regardless of specificity.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`f17850e`](https://github.com/ethlete-io/ethdk/commit/f17850eb5300d0f67a630360d3faccad4cedd5f3) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select` accepts `aria-label` / `aria-labelledby` as its accessible name, so a select labelled from outside its field no longer trips `ET2201`.

- [#3037](https://github.com/ethlete-io/ethdk/pull/3037) [`88cf3af`](https://github.com/ethlete-io/ethdk/commit/88cf3af9e61f9cc5ea7e6f547430246327c88f96) Thanks [@github-actions](https://github.com/apps/github-actions)! - Fix `et-select` not forwarding the headless `mirrorPanelWidth` input, which made the
  documented escape hatch for compact triggers unreachable from the default component.
  With `[mirrorPanelWidth]="false"` the panel sizes to its own content (capped at
  `min(400px, 100vw - 24px)`) instead of the field's width - needed whenever the trigger
  is narrower than an option row, e.g. a page-size select where the value plus the
  selected-check indicator no longer fit and the label was squeezed to a few pixels.

## 1.0.0-next.30

### Minor Changes

- [#3036](https://github.com/ethlete-io/ethdk/pull/3036) [`aa4bdde`](https://github.com/ethlete-io/ethdk/commit/aa4bdde586615ed13735ed9c970831b91323ebad) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `<et-query-devtools>` (`QUERY_DEVTOOLS_IMPORTS`): a floating, dockable panel
  that inspects the signals-first `@ethlete/query` system - queries, stacks,
  sequences, GraphQL queries, bearer auth providers, web socket clients, the
  repository cache and a rolling event log. Enable instrumentation with
  `provideQueryDevtools()` from `@ethlete/query`.

  Beyond a read-only view it can act on live queries: a searchable value explorer,
  JIT editing (apply an edited response via `setResponse`, replay with edited
  args), forcing loading / error / empty states, cache freshness countdowns with
  refetch / evict, and an "inspect" mode that highlights the component behind a
  query when you hover the live UI.

  Calls are identified by base URL (not the internal client name); stacks and auth
  providers surface identifying info (endpoint, features, queries, token-expiry
  countdown); the Stacks and Sequences drawers each keep their own selection; and a
  "Copy report" action puts a Slack-ready rich-text summary (path, args, status,
  slimmed response, GraphQL document) on the clipboard.

### Patch Changes

- [#3036](https://github.com/ethlete-io/ethdk/pull/3036) [`2699bf3`](https://github.com/ethlete-io/ethdk/commit/2699bf3fa4b7a9a906f274c6b63598ed78644f1a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Throw `ET1208` when an overlay header, body, or footer is used without an `etOverlayMain` ancestor, so the misuse surfaces immediately instead of silently rendering an unstyled region.

## 1.0.0-next.29

### Patch Changes

- [`90dad92`](https://github.com/ethlete-io/ethdk/commit/90dad922e8985b76e5f5ad67727333de6f5b9431) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlays now elevate one level above the surface their **trigger** actually sits on, resolved from the trigger's nearest surface ancestor in the DOM rather than from dependency injection. The overlay container previously read its parent surface from the injector context (`SURFACE_PROVIDER`), which is wrong across the portal boundary: an overlay's trigger keeps the injector of where it was _declared_, and the anchored panel overlays (select, cascader, date-picker, menu) mount with no DI link to the trigger at all - so they always landed at elevation 1.

  This fixes two cases:

  - A `select` (or any anchored panel) opened from **inside a dialog** now mounts at elevation 2 instead of matching the dialog's elevation 1.
  - A picker anchored to a field inside an **elevated card** (e.g. a date input in a card at elevation 1) now elevates above the card instead of staying at elevation 1.

  Nested content (submenus elevating above their parent menu) and the plain non-nested case (an overlay opened from the base page mounts at elevation 1) are unchanged. Modal dialogs still always mount at elevation 1 - a backdrop resets the visual context.

## 1.0.0-next.28

### Minor Changes

- [`b9fd6c2`](https://github.com/ethlete-io/ethdk/commit/b9fd6c2cc9dfac8211b33c4eed7039538257c2ef) Thanks [@TomTomB](https://github.com/TomTomB)! - Rename the module import arrays to SCREAMING_SNAKE_CASE for consistency with the rest of the library: `StreamImports` → `STREAM_IMPORTS`, `TabImports` → `TAB_IMPORTS`, `NavTabImports` → `NAV_TAB_IMPORTS` and `GridImports` → `GRID_IMPORTS`. Update your `imports` arrays accordingly.

- [#3034](https://github.com/ethlete-io/ethdk/pull/3034) [`deccbdd`](https://github.com/ethlete-io/ethdk/commit/deccbdda82d0df9984cdcdac1ab3485d7e080759) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: give the boxed overlay kinds (`dialog`, `anchoredDialog`, the four sheets and the full-screen dialog) a default themed pane surface - `--et-surface-background-solid` background, a `0.1rem` `--et-surface-border-solid` border (all around for dialogs; every edge but the docked one for bottom/top sheets; only the exposed inner edge for side sheets, whose block edges sit flush against the viewport), and a radius on the exposed corners (`1.6rem` dialogs/sheets, `1.2rem` anchored dialog; full-screen stays square). Plain overlay content no longer needs to paint its own surface. Overridable per instance via the new `--et-overlay-surface-background`, `--et-overlay-surface-color`, `--et-overlay-surface-border-color`, `--et-overlay-surface-border-width` and `--et-overlay-radius` tokens. Anchored/centered panes (menu, tooltip, select, date-picker) are unaffected - they still paint their own surface.

## 1.0.0-next.27

### Major Changes

- [`6f4b966`](https://github.com/ethlete-io/ethdk/commit/6f4b966c4dc0244b9dfc40978f42362fe9c89a58) Thanks [@TomTomB](https://github.com/TomTomB)! - - Cascader: renamed the `opened`/`closed` outputs to `afterOpen`/`afterClose`.
  - OTP input: renamed the `completed` output to `complete`.
  - Boolean inputs on select, cascader, selection-list, selection-option, select-option, menu item, menu selection group, switch, text-field controls, number input and scrollable now accept static attributes (e.g. `<et-select multiple>`, `renderMasks="false"`) via a `booleanAttribute` transform.

### Patch Changes

- [`ed58b19`](https://github.com/ethlete-io/ethdk/commit/ed58b19b1957f2051e0f1ef68c3814747af9ccd0) Thanks [@TomTomB](https://github.com/TomTomB)! - `etAutoSurface`: opening an overlay (date-picker, select, menu, …) no longer elevates unrelated surfaces on the base page. The overlay surface-context tracker is now matched by DOM containment, so an `etAutoSurface` only adopts an overlay's elevation when it actually renders inside that overlay's pane.

## 1.0.0-next.26

### Patch Changes

- [`13e41b0`](https://github.com/ethlete-io/ethdk/commit/13e41b04c48ccfc0f171e0693c7662435565b490) Thanks [@TomTomB](https://github.com/TomTomB)! - Drop the unused `DescriptionComponent` import from the checkbox-option and radio components (both only project `et-description` via `<ng-content>`), clearing the NG8113 unused-import build warnings.

## 1.0.0-next.25

### Minor Changes

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`08ccfb4`](https://github.com/ethlete-io/ethdk/commit/08ccfb406db0269237ce3d026036c3400dff01d6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `createV2DropzoneUpload` - a legacy `V2QueryClient` flavor of the dropzone `upload` config, mirroring `createDropzoneUpload`. Apps that haven't migrated to the new `@ethlete/query` API can now drive the dropzone from a legacy v2 creator (`client.post(...)` or a `createLegacyQueryCreator` interop wrapper); it slots into the same `upload` input and supports the full lifecycle (progress, success, failure, retry, existing values). Internally the per-file query lifecycle now runs behind an upload-handle abstraction, so both flavors share the directive/entry code and the failure display handles both `QueryErrorResponse` and `RequestError`.

- [`edb1f14`](https://github.com/ethlete-io/ethdk/commit/edb1f146792c308a0b80e8108d48934369d27b1d) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: the label is now truly optional - the label-mode layouts (`static`,
  `floating-outside`) no longer reserve the label band when no `<et-label>` is
  projected.
  - Text-field controls (`et-input`, `et-number-input`, `et-password-input`,
    `et-color-input`, `et-textarea`) now accept `aria-label` / `aria-labelledby`,
    forwarded onto the native control; a consumer `aria-labelledby` overrides the
    projected `<et-label>`.
  - In dev mode a form field whose control has no accessible name - no `<et-label>`
    and no `aria-label`/`aria-labelledby` - now throws (`ET2201`). A placeholder is
    not an accessible name.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`0ecb9db`](https://github.com/ethlete-io/ethdk/commit/0ecb9dbe116b566beab61391b2cb92f3439c07f6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: public API to insert a token chip at the caret from your own UI.
  - `RichTextEditorDirective.insertToken(type, id, opts?)` inserts a `{{type:id}}` token chip at the
    caret (or the end when unfocused), resolving its label via the trigger's `resolveItem` - the same
    result as picking it from the `#`/`@` popup. `insertTokenItem(type, item, opts?)` does the same
    when you already hold the resolved `{ id, label }`. The directive now also exports as
    `etRichTextEditor`.
  - New opt-in `et-rich-text-editor-token-palette` component (via `RICH_TEXT_EDITOR_TOKEN_PALETTE_IMPORTS`):
    a click-to-insert chip row driven by the same `RichTextEditorTrigger[]`.

- [#3029](https://github.com/ethlete-io/ethdk/pull/3029) [`129c3c9`](https://github.com/ethlete-io/ethdk/commit/129c3c97c8b2e62fd4532ba03e7cf9bf6aaee764) Thanks [@EliasPapavlassopoulos](https://github.com/EliasPapavlassopoulos)! - Add a two-way `mixed` bulk-edit state (plus `mixedLabel` where the control has a text display slot) across the form controls: select (single, multi, searchable, headless, virtualized), cascader, input, number-input, password-input, textarea, color-input, date-input, time-input, date-time-input, date-range-input, duration-input, tag-input, phone-input, slider, range-slider, rating, and the selection-list groups (radio, checkbox-group, segmented). While `mixed` is set the raw form value stays untouched and masked; the first user commit replaces it and resolves the state. All implementations follow one executable contract (shared conformance suite); checkbox keeps expressing the concept via its platform-named `indeterminate`, and switch deliberately stays two-state (ARIA forbids a mixed switch).

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b5c0207`](https://github.com/ethlete-io/ethdk/commit/b5c0207db2af40b15f8575e3f6c721d07cf81b2f) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select` (and the headless `[etSelect]`) gains the `[etSelectOptions]` directive: bind the bundle returned by `selectOptionsFromQuery` or `selectOptionsFromV2Query` with a single attribute and it wires the async plumbing for you - forwarding `loading`, `error` and `hasMoreItems`, forcing `filterMode` to `external`, and driving the bundle's `setQuery`/`loadMore` from the select's `(queryChange)`/`(loadMore)` outputs. You only render the options. Both factories return the same shape, so one directive serves the current query client and the legacy `V2QueryClient` alike. The manual per-input wiring stays fully supported.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`5fc9aa4`](https://github.com/ethlete-io/ethdk/commit/5fc9aa4316390c2db908c6dcd3c2118945a11089) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select` (and the headless `[etSelect]`) gains an `pickOption` output and a `pickOnly` input. `pickOption` emits the picked value whenever a single-select option is committed - a "the user actively picked this" signal distinct from `valueChange`. With `pickOnly`, committing an option emits `pickOption` without ever writing `value`, so the select stays empty: a fire-and-forget "add" picker that feeds an external list without the set-then-clear dance (and its race with the `[(value)]` write-back). `pickOnly` has no effect in multi-select.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`6605423`](https://github.com/ethlete-io/ethdk/commit/6605423235364f06c07e827205de2c3a351a538f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Switch now supports an `indeterminate` state (two-way `[(indeterminate)]`), mirroring checkbox - the first toggle resolves it to on. Since `role="switch"` cannot carry `aria-checked="mixed"`, it's presentational only (thumb parks mid-track behind `data-indeterminate`; `aria-checked` stays boolean). The mixed/indeterminate state on the graphical controls (rating, slider, range-slider, checkbox-group, radio-group, switch) now uses a consistent dashed "provisional" treatment so it reads as "values differ" rather than empty.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`d738771`](https://github.com/ethlete-io/ethdk/commit/d738771a05b4505616defab52359870892bae171) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `createOverlayUnsavedChangesGuard` - the overlay flavor of the `unsavedChanges` family. Called from an overlay content component's injection context, it injects the current `OVERLAY_REF` and vetoes a dismissal (outside pointer, escape, drag, or a programmatic `close()`) while the watched form has unsaved changes, runs the `confirm`, and only then re-issues the close. Per-source opt-out via `dismissSources`, honors `disableClose`, and auto-cleans up on injector destroy.

  Also exposes the underlying close-veto seam on `OverlayRef`: `registerCloseGuard(guard)` and `forceClose(source?, result?)`.

### Patch Changes

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b5b037e`](https://github.com/ethlete-io/ethdk/commit/b5b037e6e4e1c1d1ecef9c4c13edab01e40a1d0f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Fix anchored panels (`select`, `cascader`, the date/time pickers) closing when a popover opened from inside them is clicked. A nested overlay (a select body, menu or tooltip) mounts as a sibling pane in the overlay root, not a DOM descendant, so the panel's outside-pointer check treated a click in the child as an outside dismissal and closed itself. The check now resolves the whole nested overlay tree - anchored by each pane's `origin` - so a pointerdown anywhere inside a descendant popover no longer dismisses the panel that opened it.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`4d70fb1`](https://github.com/ethlete-io/ethdk/commit/4d70fb1fd173e7e9d25031551f752196abb6f94e) Thanks [@github-actions](https://github.com/apps/github-actions)! - `etAutoSurface` now elevates correctly for content rendered inside an overlay. Projected/portaled content keeps the injector of where it was _declared_ (the trigger location), not the pane it renders into, so an `etAutoSurface` inside a select body, menu, date-picker, etc. resolved its parent surface from the outer trigger context and came out one elevation too low - the same level as the overlay's own panel instead of one above it.

  `AutoSurfaceDirective` now also consults the root surface-context tracker (which records the innermost open overlay's surface across the portal boundary) and takes whichever parent surface sits higher. Overlay panels that are themselves the overlay's surface (menu, select/date/cascader panels, tooltip, toggletip) opt out via the new `AutoSurfaceDirective.ignoreOverlaySurfaceContext()` so they keep adopting their overlay's elevation rather than stacking above it - their rendered surface is unchanged.

- [`995eab1`](https://github.com/ethlete-io/ethdk/commit/995eab158002c0e36779cbd54dbbaf7da9355f58) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: clear ("×") buttons now fade in/out (opacity only) instead of appearing abruptly, consistently across date, time, date-time, duration, phone, select, and cascader. Respects `prefers-reduced-motion`. `et-date-range-input` gains the same clear button (new `clearable`/`clearLabel` inputs).

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`43e8711`](https://github.com/ethlete-io/ethdk/commit/43e8711f49ca995a4fdb95d95359219bd8298407) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form fields now keep their focused styling (accent border, lit label/affix) while a control's popup is open. Opening a date/time/date-range picker, select or cascader panel moves focus into the detached overlay, so `:focus-visible` no longer matched the field and it visibly dropped back to its resting look - controls now report an `expanded` state the field reflects as `[data-expanded]`.

  Also fixes a flicker on the date-picker trigger button: clicking it while the field was focused briefly blurred the input (hiding the clear button and dropping the focused style) one frame before the picker opened. The trigger now prevents the mousedown default, matching the clear button, so focus stays on the field through the toggle.

- [`246bb5e`](https://github.com/ethlete-io/ethdk/commit/246bb5ee26d6c28adacea316426a5af19b248a17) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: text-field controls (`et-input`, `et-number-input`,
  `et-password-input`, `et-textarea`) no longer render an empty `autocomplete=""`
  attribute when no autocomplete is set - the attribute is now omitted, clearing
  Chrome's "Incorrect use of autocomplete attribute" warning.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b712197`](https://github.com/ethlete-io/ethdk/commit/b712197005495bc180e86d9645f77032da9fb266) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date/time/date-range pickers, select and cascader now flip their alignment on the same side before flipping vertically: their anchored fallback placements changed from `['top-start']` to `['bottom-end', 'top-start', 'top-end']`. A field near the right viewport edge now opens right-aligned under the field (`bottom-end`) instead of being cross-axis shifted, matching the fallback behaviour menus already use.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`62dbf77`](https://github.com/ethlete-io/ethdk/commit/62dbf77444238841fcd22a1c39467fd7f577d707) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor content no longer retints when the editor gains focus. The field frame is an `et-color-interactive--has-focus` ancestor that re-resolves the accent tokens on focus, and rendered content reading the accent - token chips (their outline and fill), links and the caret - inherited that shift. The content root now re-anchors the accent tokens to their resting value, insulating it from the field's interaction state (the same immunity the interactive toolbar buttons already have from carrying `et-color-interactive`).

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`5fc9aa4`](https://github.com/ethlete-io/ethdk/commit/5fc9aa4316390c2db908c6dcd3c2118945a11089) Thanks [@github-actions](https://github.com/apps/github-actions)! - `et-select`: a searchable single select with a custom value template (`etSelectValue`) now swaps the rich display for the option's editable plain-text label inside the search input while the field is focused (edit mode), and restores the rich template on blur. Keyboard editing is now at parity with a plain searchable single select - the label is selected on open, Backspace edits the visible text, and erasing it clears the selection. Previously the input stayed empty in this case, so a single Backspace silently deleted the whole selected value with nothing visible to edit.

- [`139d734`](https://github.com/ethlete-io/ethdk/commit/139d73474ec710834a28df50160c2cce1e795c1c) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: trigger-based controls (select, date pickers) keep their focused frame after a pointer-driven commit, so the frame and the clear affordance no longer disagree about whether the field is focused.

- [#3030](https://github.com/ethlete-io/ethdk/pull/3030) [`b7a6582`](https://github.com/ethlete-io/ethdk/commit/b7a6582b0b4753c551617de8282a43df841847d6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select panel: a width-mirrored panel now matches its field at any width. The panel carried a `max-inline-size: 400px` cap, so on fields wider than 400px the dropdown stopped matching the trigger and rendered narrower than the field. The cap is now scoped to compact triggers (`mirrorPanelWidth={false}`), where the pane is content-sized and still needs an upper bound; when the panel mirrors the field the pane width alone sizes it, with no cap.

## 1.0.0-next.24

### Major Changes

- [#3028](https://github.com/ethlete-io/ethdk/pull/3028) [`d2b47d7`](https://github.com/ethlete-io/ethdk/commit/d2b47d7b0017f957ba4bb442e421c017973a11b3) Thanks [@github-actions](https://github.com/apps/github-actions)! - Select: renamed the outputs `loadMoreRequested` → `loadMore` and `addNewRequested` → `addNew` (present-tense event names). Update your `(loadMoreRequested)` / `(addNewRequested)` bindings accordingly.

  `selectOptionsFromQuery` and `selectOptionsFromV2Query` now handle load-more paging internally: `args` receives a `page` signal (starting at `initialPage`, default `1`) that resets on query change, the returned bundle exposes `loadMore()` to wire to `(loadMore)`, and each page's `toOptions` slice is appended to the accumulated `options`.

### Patch Changes

- [#3028](https://github.com/ethlete-io/ethdk/pull/3028) [`d8f50c5`](https://github.com/ethlete-io/ethdk/commit/d8f50c530b976390a8e655f3b1a4c0b9eaaae6ab) Thanks [@github-actions](https://github.com/apps/github-actions)! - Hover styles across all interactive components (buttons, chips, form controls, selects, cascader, menu, tabs, calendar, time picker, notification) no longer stick after tapping on touch devices - including the `etColorInteractive`/`etSurfaceInteractive` hover token resolution (guarded by `@media (hover: hover)`).

## 1.0.0-next.23

### Minor Changes

- [`221c878`](https://github.com/ethlete-io/ethdk/commit/221c878d5f3e382ffed074bf93ab30afeda9d63f) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: flat search across all levels. Implement the optional `search(query)` hook on the `CascaderDataSource` (returning root → match path chains) and the panel gains a search input that swaps the columns for a flat, breadcrumb-labelled result list - committing a match closes, while a branch-only match jumps the columns to it. New headless pieces `etCascaderSearch` and `etCascaderSearchOption`; `et-cascader` renders the input automatically (`searchPlaceholder` input) and Escape now clears an active query before closing the panel.

- [`221c878`](https://github.com/ethlete-io/ethdk/commit/221c878d5f3e382ffed074bf93ab30afeda9d63f) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: `cascaderFromQuery` builds a `CascaderDataSource` from `@ethlete/query` creators - per-level loads (concurrent, deduped/cached by the client), optional flat-search wiring with debounce and `minQueryLength`, and a `resolvePath` passthrough. The cascader's default `toErrorMessage` now shows an `Error`'s `message` verbatim (falling back to the generic text), so query failure messages surface without extra wiring.

- [`221c878`](https://github.com/ethlete-io/ethdk/commit/221c878d5f3e382ffed074bf93ab30afeda9d63f) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: multi-select via the new `multiple` input - activations toggle values (the form value becomes a `T[]`), the panel stays open, rows gain check squares, ancestors of a partial selection show an indeterminate dash and promote to a full checkmark once all their loaded descendants are selected. Search results toggle in place (keeping the result list), the trigger joins the selected labels, and programmatic values resolve their chains through `resolvePath`. The `value` model is now typed `T | T[] | null`.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Cascader: new `et-cascader` / `[etCascader]` (`CASCADER_IMPORTS`) - a generic hierarchy value control that browses an abstract `CascaderDataSource<T>` level by level (sync array, `Promise` or `Observable`, each level lazy-loaded). Miller columns on desktop, single-column drill in a bottom sheet on mobile; `selectableLevels` (`'leaf'` | `'any'`), `path`/`pathValue` chain, per-column loading/empty/error states with retry, full ARIA tree keyboard navigation, and signal-forms integration. Error block `ET3300`–`ET3399`.

  Deep hierarchies stay compact: the desktop panel shows at most `maxVisibleColumns` (default 3) columns side by side, showing the whole drilled trail as a breadcrumb row below the columns once it overflows. All drilled levels ride a sliding track, so collapsing into a crumb (and navigating back out of one) is a coordinated slide rather than a pop. Navigating back is non-destructive - a crumb click or Arrow Left past the window edge slides the column window without discarding the deeper drill. Headless: `visibleColumns()`, `breadcrumbPath()`, `visibleColumnStart()`, `showColumn()`.

- [#3027](https://github.com/ethlete-io/ethdk/pull/3027) [`0a62001`](https://github.com/ethlete-io/ethdk/commit/0a6200181b706828bc8b228afb0743a269bd7e8e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: add `et-date-time-input` (+ headless `[etDateTimeInput]`), a combined date & time control with a string wire value - one field with a combined display format (strict-then-lenient typed entry, bare dates commit at midnight) and a picker overlay hosting calendar and time picker side by side (Date/Time tabs in the bottom sheet). A first day pick in the picker also commits at midnight - never the current wall-clock time.

- [`8bfe3ed`](https://github.com/ethlete-io/ethdk/commit/8bfe3ed805a760f13a5cef11125473b1342d747c) Thanks [@TomTomB](https://github.com/TomTomB)! - Date, time, date-time and date range inputs: new opt-in `mask` input. With a fixed-width numeric `displayFormat` (`dd.MM.yyyy`, `HH:mm`, …) typing gets guide placeholders (`__.__.____`), auto-inserted separators, paste filtering and a numeric soft keyboard; the lenient blur/Enter commit parsers stay authoritative. Formats a mask can't represent (locale formats like the default `P`/`p`, variable-width or text tokens) are refused with a dev-mode warning and typing stays unmasked. On the date range input each side is its own mask host, so the guide follows the focused field. The duration input deliberately gets no mask (unbounded first segment, right-anchored lenient entry). Supporting API: `[etInputMask]` now accepts `null` to disable the mask conditionally, and `InputMaskHost` grew an optional `resumeNativeSync()` for hosts whose mask can toggle off again.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Duration input: new `et-duration-input` / `[etDurationInput]` (`DURATION_INPUT_IMPORTS`) - a duration control whose value is total elapsed **milliseconds** (`number | null`), kept out of the `Date` system. Configurable segment layout (`durationFormat`, e.g. `mm:ss`, `hh:mm:ss`, `hh:mm:ss.SSS`) with a lenient typed parse (`130` → `1:30`) committing on blur/Enter. Error code `ET3050` inside the shared date-time block.

- [`4c6b6d0`](https://github.com/ethlete-io/ethdk/commit/4c6b6d000ba568d73c8b191c52fed3206b6a00a6) Thanks [@TomTomB](https://github.com/TomTomB)! - Chip: filter-chip support - `etSelectionList` + `etSelectionOption` compose directly onto `et-chip` for selectable chip groups (single or multiple), with a color-theme tonal selected state and hover/focus affordances. Selection options now tolerate late-bound `value` inputs (directive compositions no longer throw NG0950).

- [`04ffa53`](https://github.com/ethlete-io/ethdk/commit/04ffa53bf3b65977bd4f87d312781faa93057d1f) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: fix bugs and accessibility issues across the form controls, and add a few
  opt-in APIs.
  - **Fixes:** select-all no longer sticks on "mixed" when a disabled option is
    present; a cascader value set programmatically now shows its breadcrumb (via a
    new optional `resolvePath` on the cascader data source); typed date/time/range
    values no longer leak the current wall-clock time; duration/date/time null the
    value on an unparseable commit; masked inputs no longer break IME composition;
    standalone `input[etInput]` now syncs on keystroke; number steppers mark the
    field touched and can't leak their auto-repeat timer; OTP re-emits `completed`
    when a full code is replaced; color inputs honor `[readonly]`.
  - **Accessibility:** multi-select options and the select-all control now use
    `role="checkbox"` (not `option`); a parse error is announced with a real
    message and `aria-describedby`; the date picker panel is a named
    `role="dialog"`; the cascader trigger's `aria-controls` resolves; select
    panels keep only options inside the listbox; the phone country trigger and
    cascader columns gained accessible names/typeahead; a schema-`hidden` field is
    now actually hidden; Caps-Lock detection also samples on focus.
  - **New inputs:** `parseErrorMessage` (date/time/date-time/duration/range),
    password `hideLabel`, phone `countryLabel`, date-picker-panel `dialogLabel`.
  - **Note:** the checkbox now toggles on `keydown` Space (matching switch and the
    selection options), and the select panel renders its listbox as an inner
    element - restyle if you targeted the panel host as the listbox.

- [`888ce8a`](https://github.com/ethlete-io/ethdk/commit/888ce8a504c7001f2fb50ae83302483d7148486a) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms consistency: `readonly` and one-click clearing across more controls.
  - Checkbox, switch and the three selection-list groups now honor `readonly` (e.g. from a `readonly(...)` schema): normal look, still focusable (`aria-readonly`), toggling/selecting blocked - arrows in a readonly radio group move focus without selecting.
  - Date, time, date-time, duration and phone inputs render a clear (×) button while the focused field holds a value (`clearable`, default on; label via `clearLabel`), backed by a public `clearValue()` on their headless directives.

- [`85d7332`](https://github.com/ethlete-io/ethdk/commit/85d73327be9a5fc2154c5a0f0f2defe25e657a55) Thanks [@TomTomB](https://github.com/TomTomB)! - Masked input: the mask now attaches through a public `INPUT_MASK_HOST` contract (provided by `et-input` out of the box), so custom field directives can host `[etInputMask]` too. Pattern masks additionally expose `complete()` on the directive (`0`/`a`/`*` slots required, `9` optional; `null` for masks without completeness) via a new optional `MaskSpec.isComplete`.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Masked input: new `[etInputMask]` directive layering input masking onto `et-input` - pattern-string masks (`00-00-0000` style grammar) or `MaskSpec` objects, with `createCurrencyMask` / `createIbanMask` / `createCardMask` factories, raw-or-masked form values (`maskValueMode`, raw by default), focused-state guide placeholders (`placeholderChar`) and full caret handling (`MASKED_INPUT_IMPORTS`).

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Number input: new `stepper` input on `et-number-input` rendering −/+ buttons with press-and-hold auto-repeat, `min`/`max` clamping and bound-aware disabling; the headless `NumberInputDirective` gains `stepBy(direction)` / `canStepUp` / `canStepDown`. Adds the `et-minus` built-in icon.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Password input: new `et-password-input` / `[etPasswordInput]` (`PASSWORD_INPUT_IMPORTS`) - reveal toggle (`revealed` model, `revealable`, `aria-pressed`), opt-in Caps Lock warning (`capsLockWarning`), and a `strength` signal (0–4 typing-feedback heuristic) for composing strength meters. Adds `et-eye` / `et-eye-slash` built-in icons.

- [`36ac99d`](https://github.com/ethlete-io/ethdk/commit/36ac99db8ccf70597d2dda3e845effe4e0687ba9) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: full tag-input ergonomics in custom-value mode (`allowCustomValues`).
  - A "Create …" listbox row (label via `createLabel`) now offers the query as a custom value even while options still match - keyboard-reachable via virtual focus; headless compositions use `customValueCandidate()` + `customValueOption`.
  - New inputs: `customValueSeparators` (characters that commit while typing and split pastes), `commitCustomValueOnClose` (pending text commits on Tab/outside-click close instead of being discarded), `normalizeCustomValue` (map/reject raw text), and `maxSelection` (caps multi selection and locks the search input while full, exposed as `isFull()`; unselected options render disabled while full - deselecting frees them again).
  - `commitCustomValue(raw)` is now public for imperative commits.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new `et-select-option-group` / `[etSelectOptionGroup]` for labelled listbox sections. Grouping is presentational - options stay flat for keyboard navigation and typeahead - and a group hides itself once all its options are filtered out under `filterMode="internal"`. `role="group"` + `aria-labelledby`; token `--et-select-option-group-label-font-size`. Error code `ET1009`.

- [`b61ad0f`](https://github.com/ethlete-io/ethdk/commit/b61ad0fbe61ed1b0e7e8cd98e8d673ae91f10ff1) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new `selectOptionsFromV2Query` feeds the async select from a legacy `V2QueryClient` query (or a `createLegacyQueryCreator` interop wrapper) - the `V2QueryClient` counterpart of `selectOptionsFromQuery`, returning the same signal bundle.

- [`4f34f1f`](https://github.com/ethlete-io/ethdk/commit/4f34f1fa2ef1809f6b281d52fdc0f037923e88db) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new data-driven `options` input with built-in virtualization for large option lists.
  - `options` takes `SelectOptionData[]` (`{ value, label, disabled? }`) - the select renders the rows itself and windows them, so only the rows near the viewport exist in the DOM (2000 options ≈ 15 rendered nodes). Internal filtering, keyboard navigation, typeahead and closed-panel label resolution work across the full data set.
  - `etSelectOptionTemplate` customizes the row content of data-driven options, with the source entry (extra fields included) as template context.
  - Headless: `etSelectViewport` marks the scroll container to window against, `etSelectVirtualOption` renders one windowed item, and `virtualizedItems()` / `virtualWindow` on `[etSelect]` expose the window state.
  - Breaking for headless consumers of `SelectItem`: `elementRef` is now `element: Signal<HTMLElement | null>` (`null` for a data-driven option outside the rendered window).

- [`a41491d`](https://github.com/ethlete-io/ethdk/commit/a41491db447152e69902020d19bfc30bccf3b01d) Thanks [@TomTomB](https://github.com/TomTomB)! - Server violations → signal-forms bridge:
  - `@ethlete/query`: `mapViolationsToFormErrors({ fieldTree, error, rewritePath?, onUnmappedViolation? })` maps an API error's violation list onto a signal form's fields (unmapped violations become form-level errors, violation-free failures degrade to a form-level `etServerError`), plus `extractFormViolations(error)`, `executeUntilSettled(query, executeArgs?)` for awaiting one execution as a settled snapshot, and the `isQueryErrorResponse` guard.
  - `@ethlete/components`: `provideFormErrorMessageResolver(resolver)` lets apps centralize/localize the text `et-form-error` renders by error `kind`; the error's own `message` stays the default.

- [`f005c94`](https://github.com/ethlete-io/ethdk/commit/f005c944f7edf67842d0a3e635d7e35e8de44445) Thanks [@TomTomB](https://github.com/TomTomB)! - Slider: new `et-slider` (single value) and `et-range-slider` (`[start, end]` tuple with `minDistance`) form controls, plus the headless `[etSlider]` / `[etRangeSlider]` / `[etSliderTrack]` / `[etSliderThumb]` directives and an `ng-template[etSliderThumbLabel]` value-label slot. Pointer drag with capture, full ARIA slider keyboard model, RTL-aware, signal-forms integrated (`SLIDER_IMPORTS`).

- [`53881a8`](https://github.com/ethlete-io/ethdk/commit/53881a84acf85f094baf50cf73e37fc88ac70461) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: new `wireFormSupport(support, refs)` helper owns the support-region view-child wiring for custom controls built on `injectFormSupport` (the built-in controls now use it).

### Patch Changes

- [`7c16ecf`](https://github.com/ethlete-io/ethdk/commit/7c16ecf4e8b74f228b3734f50146e8e669e61470) Thanks [@TomTomB](https://github.com/TomTomB)! - Calendar and select polish:
  - Calendar: disabled days no longer react to hover, and the hovered endpoint of a range preview renders as a filled circle (like a selected date) instead of a half-filled band capped by a ring.
  - Select: while the panel is open, async loading shows only the panel spinner instead of a second one in the field.

- [`ddb3413`](https://github.com/ethlete-io/ethdk/commit/ddb3413c2673a4f2f513598a208f376b36b7535b) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: dragging (or keyboard-moving) an item downward onto other items now swaps them into the vacated space when they fit, instead of requiring the drag to clear the entire collider before anything repositions.

- [`ddb3413`](https://github.com/ethlete-io/ethdk/commit/ddb3413c2673a4f2f513598a208f376b36b7535b) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid items can now be moved with touch: `[etDragHandle]` sets `touch-action: none` on its host while enabled (the browser was claiming touch pointermoves for scrolling and cancelling the gesture), and read-only grids keep normal touch scrolling.

- [`06377b6`](https://github.com/ethlete-io/ethdk/commit/06377b6312fd32c7d1f497816fa91a655bf72d19) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay: a color theme provided on the app root component (e.g. `ProvideColorDirective` via `hostDirectives` plus `forceColor()`) now propagates into overlays even when they are opened without a `viewContainerRef`, and updates reactively while the overlay is open.

- [`f1841b7`](https://github.com/ethlete-io/ethdk/commit/f1841b7ec3a4f6e280c961d072a90fd2ceba75d7) Thanks [@TomTomB](https://github.com/TomTomB)! - Phone input: picking a country prefix now moves focus to the number field instead of back to the prefix toggle (closing the picker with Escape still refocuses the toggle).

- [`57a5104`](https://github.com/ethlete-io/ethdk/commit/57a5104d3805824cf6b28725c5d9aae670af9626) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: rubber-band overscroll (macOS) no longer drags the panel background along with the list, exposing the page behind the overlay - the panel chrome now sits on a non-scrolling element around an inner `.et-select-panel-scroller`.

- [`fa0e118`](https://github.com/ethlete-io/ethdk/commit/fa0e1189f46a5359f5018fba15fbb405af646314) Thanks [@TomTomB](https://github.com/TomTomB)! - Select option checkmarks and menu radio/checkbox item indicators now render on the right (trailing) edge of their row instead of the left, so option labels align flush with the row start. Standalone form controls (checkbox, radio, switch, selection lists, cascader check squares) keep their leading position.

## 1.0.0-next.22

### Minor Changes

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Calendar & date inputs: new date foundation for `@ethlete/components`.
  - `et-calendar` (`CALENDAR_IMPORTS`): inline month calendar on plain `Date`s with single and range selection, `min`/`max`/`dateFilter`, localized labels and the full ARIA-grid keyboard model; headless `[etCalendar]` / `[etCalendarGrid]` / `[etCalendarCell]` for custom markup.
  - `et-date-input` (`DATE_INPUT_IMPORTS`): `string`-valued date field (`valueFormat`, ISO by default) pairing strict typed entry against a locale-aware `displayFormat` with an anchored calendar picker; unparseable text stays visible and raises `parseError` while the value stays `null`.
  - `et-date-range-input` (`DATE_RANGE_INPUT_IMPORTS`): one control with two fields sharing a range-mode picker; value `{ start: string | null; end: string | null }`.
  - New `provideDateFormat` / `provideTimeFormat` / `provideDateLocale` tokens and a `date-fns` (v4) peer dependency.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Chip: new `et-chip` component (pill with optional remove button, Backspace/Delete removal) plus headless `[etChip]` / `[etChipRemove]` directives, exported as `CHIP_IMPORTS`.
  - Selection list: the item registry/selection API moved from the group directive onto its `selection` property (`list.selection.select(...)` instead of `list.select(...)` on the `SELECTION_LIST_TOKEN` contract); group behavior is unchanged.
  - `SelectionListItem` gains optional `id` and `label` signals.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`13fc0af`](https://github.com/ethlete-io/ethdk/commit/13fc0af8d5eabbe6da7461c6fb8507b2e2e0407f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date & time pickers (date, date range, time) open as a backdropped bottom sheet with drag-to-dismiss and touch-sized cells on viewports below the `md` breakpoint; anchored panels are unchanged from `md` up. Interactive controls (buttons, select trigger, calendar cells, time picker options, picker triggers) now set `touch-action` so taps activate without the double-tap-zoom delay on touch devices.
  - Calendar: month navigation slides the new grid in from the travel direction (skipped under `prefers-reduced-motion`); the headless `[etCalendar]` exposes `navigationDirection` and `visibleMonthKey` for custom transitions. In the bottom sheet the calendar reserves the 6-week height so the sheet never resizes.
  - Calendar / time picker: keyboard focus is no longer lost when the focused cell/option is re-created mid-interaction (month crossing, an off-step option leaving the list).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-otp-input` control (`OTP_INPUT_IMPORTS`) - segmented one-time-code/PIN entry backed by a single invisible native input for reliable SMS autofill (`autocomplete="one-time-code"`) and native paste. `length`/`charset` (numeric, alphanumeric or RegExp)/`masked` inputs, a `completed` output per full entry, separator-stripping paste handling, and tokens `--et-otp-input-segment-size/-gap/-radius`. Typed characters pop in and the active segment shows a blinking synthetic caret (both respect `prefers-reduced-motion`).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-rating` control (star rating, `RATING_IMPORTS`) - `FormValueControl<number | null>` implementing the slider pattern: hover preview, drag/swipe rating (mouse and touch, commits on release), half steps (`allowHalf`), click-again/Backspace to clear, arrow-key stepping, and a custom icon slot (`ng-template[etRatingIcon]`). The fill animates as one continuous sweep. Tokens `--et-rating-icon-size` / `--et-rating-gap`.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`d651c4c`](https://github.com/ethlete-io/ethdk/commit/d651c4ccacb309db808f71ebc6ceda8e5e0ffe82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-tag-input` control (`TAG_INPUT_IMPORTS`) - free-text tags as removable chips with an inline field inside the `et-form-field` shell. Commits on configurable `separators` (Enter/comma by default) and blur, `normalizeTag`/`allowDuplicates`/`maxTags`, Backspace removes the last tag, and pastes split on separators and newlines. For tags with suggestions, compose the select (`multiple` + search + `allowCustomValues`) instead.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: three new form-field controls and a small headless API addition.
  - `et-textarea` (+ headless `TextareaDirective`): multi-line plain-text control with autosize on by default (`rows`, `minRows`, `maxRows`, `resize`).
  - `et-number-input` (+ headless `NumberInputDirective`): numeric input whose form value is `number | null` (empty reads as `null`), with `min`/`max`/`step`; native spin buttons hidden.
  - `et-color-input` (+ headless `ColorInputDirective`): native color picker as a swatch + hex value, form value `'#rrggbb' | null`; tokens `--et-color-input-swatch-size` / `--et-color-input-swatch-radius`.
  - `InputDirective` (and the new input directives) now expose a public `nativeControl` signal referencing the native element, for integrations such as input masking.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`e0b71b1`](https://github.com/ethlete-io/ethdk/commit/e0b71b19a3a14c2c2250d7a217299f7956bb5c3b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `provideIconOverrides()` to swap the built-in `et-*` icons app-wide (or per subtree) - e.g. with your own Font Awesome set. Overrides are keyed by name/variant and merged on top of each component's own `provideIcons()`, so they reach into components that self-register the same name while leaving unlisted icons on their default. The override `name` autocompletes to the built-in set via the new `ET_BUILT_IN_ICON_NAMES` / `EtBuiltInIconName` exports, and any other string still registers a brand-new icon.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`f168303`](https://github.com/ethlete-io/ethdk/commit/f168303bf0a78c559d6733d04c92a1a1c632d42a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: new `et-multi-language-rich-text-editor` - authors the same content in several consumer-defined `languages`, switching between them from a toolbar dropdown that flags which languages are still empty. Its value is a `Record<languageCode, markdown>`, so every translation persists in one form field; bind it with `[formField]` and use the exported `requiredLanguages` validator to require specific translations.

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Forms: new `et-phone-input` control (`PHONE_INPUT_IMPORTS`) - tel entry with a searchable country picker built on the select's headless core. Value is normalized `+<dial><national>`.
  - Typing/pasting `+…` (or a `00…` international prefix) re-derives the country by longest dial-code match; manual picks survive shared codes like `+1`, switching countries keeps the national number, and a leading national trunk `0` is stripped (`0171…` → `+49171…`).
  - Digits are grouped for display while unfocused (cosmetic only); the country picker searches names and dial codes, shows an empty state, keeps a fixed panel width, and takes custom flag art via `ng-template[etPhoneInputFlag]`.
  - Zero runtime dependency: ISO + dial codes shipped, names via `Intl.DisplayNames`, emoji flags.
  - The underlying select gained a `mirrorPanelWidth` input (off for compact triggers), with the panel capped at `min(400px, 100vw - 24px)`.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the link flow is now a responsive popover (arrow-anchored on wider screens, a keyboard-pinned top sheet on touch) to edit a link's text and URL, with an open-in-new-tab toggle - replacing the browser `prompt()`. New-tab links persist through the Markdown value as raw HTML (`<a target="_blank" rel="noopener noreferrer">`); ordinary links stay `[text](url)`. `htmlToMarkdown` / `markdownToHtml` in `@ethlete/core` now round-trip `target="_blank"` anchors (sanitized href + forced `rel`). After applying a link the caret moves just past it, with a trailing space added when the link ends the line.

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: mobile toolbar and editing fixes.
  - On touch devices the static toolbar docks above the on-screen keyboard while editing (tracked via `visualViewport`, staying pinned as the page scrolls and inside a same-origin iframe) instead of sitting at the top under the platform's selection menu; it fades in only once the editor is active and its menus open without stealing keyboard focus. With a mouse/trackpad it stays at the top as before.
  - The editable area's font size is floored at 16px on touch so iOS Safari no longer zooms the page on focus.
  - Toggling a mark off at the end of a line is no longer undone by the next space.
  - Escape (or the close button) in the link editor returns focus to the editor.
  - Tab/Shift+Tab move between table cells and step the caret out past the first/last cell.
  - `OverlayRef` gained `afterClosedEvent()`, which also reports how the overlay was closed (`escape`, `outside-pointer`, `api`, …).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor:
  - Table tool: the grid-size picker supports touch - drag across the grid to size the table and release to insert; when a table's header row was deleted the menu offers **Insert header row**, and inserting a row from the header now lands in the table body.
  - The link editor and floating toolbar anchor to the selected text (not the full-width block) so the arrow points at the text, and the link editor now opens correctly in an empty editor.
  - The trailing space inserted after atomic tokens (mentions, merge fields) and line-ending links is now a no-break space (Chrome dropped the plain one, gluing the next word); it still serializes as a regular space.
  - Form field: the `inline` label mode now lays out correctly around rich text editors.
  - `RichTextEditorToolDefinition` gains an optional `keydown` hook; table caret navigation now ships with `provideRichTextEditorTableTool` via that hook instead of being bundled into every editor (`editorDom.tableExit` / `tableEnter` are removed) - provide the table tool if your content can contain tables.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`1f03013`](https://github.com/ethlete-io/ethdk/commit/1f03013609e8a734788db5b3b7657973fb430b87) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: toolbar accessibility and pressed-state polish.
  - Toolbar buttons that open a menu or popover (heading, alignment, table, link) now show their pressed state while the popover is open.
  - The toolbar is now a single tab stop following the ARIA toolbar pattern: Tab enters it, `ArrowLeft`/`ArrowRight` (plus `Home`/`End`) move focus between buttons, and the next Tab moves on to the editor content.
  - `et-icon-button` now forwards the `emitAriaPressed` input, so `aria-pressed` can be suppressed on pressed-styled buttons that already expose `aria-expanded`.

- [#3024](https://github.com/ethlete-io/ethdk/pull/3024) [`144832a`](https://github.com/ethlete-io/ethdk/commit/144832ae74abfdbe8f084c14d6a903ee2eda18cf) Thanks [@TomTomB](https://github.com/TomTomB)! - Select: new `et-select` form control - a combobox-pattern trigger opening an anchored, width-mirrored listbox panel (`SELECT_IMPORTS`, plus the headless `[etSelect]` / `[etSelectTrigger]` / `ng-template[etSelectSurface]` / `[etSelectListbox]` / `[etSelectOption]` graph and `et-select-panel` / `et-select-option`). Integrates with `et-form-field` (new `select` control type, all label modes).
  - Single select: full keyboard model - arrows/Home/End move virtual focus via `aria-activedescendant`, Enter/Space commit, typeahead while open, printable keys commit directly while closed; resolves a preselected value's label without ever opening the panel.
  - Multi select (`multiple`): array value, options toggle without closing (`aria-multiselectable`), selection shown as removable `et-chip`s; `deselectOption(...)` and a customizable `ng-template[etSelectValue]`.
  - Search (`input[etSelectSearch]`): inline searchable combobox; `filterMode` `'internal'` (default) or `'external'` (via the `queryChange` output), `allowCustomValues`, and `selectOptionsFromQuery(...)` to feed options from an `@ethlete/query` query (debounce, `minQueryLength`, `toHasMore` pagination).
  - Async state inputs `loading` / `error` / `hasMoreItems` render default panel rows (spinner / alert / load-more via `loadMoreRequested`), each overridable through `ng-template[etSelectLoading]` / `[etSelectError]` / `[etSelectEmpty]`.
  - `allowAddNew` shows an "Add new" row emitting `addNewRequested` with the current query (`addNewLabel`); a `clearable` (×) control clears the value; clicking anywhere on the control frame opens the panel.
  - Options render with `content-visibility: auto` and animated hover so panels with thousands of options stay responsive; the panel animates its block size on content change.
  - `readonly` chips (select and tag input) keep their normal look and drop the remove button; disabled form fields no longer show hover feedback.
  - Form field exposes `controlFrameElement` on its contract so overlay-based controls can anchor their panels to the visible box.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`bd8ec82`](https://github.com/ethlete-io/ethdk/commit/bd8ec8205d080bbfad58760dab13d346159b7a1c) Thanks [@github-actions](https://github.com/apps/github-actions)! - New time controls:
  - `et-time-picker` (+ headless `[etTimePicker]` column/option directives): inline column-list time picker on `Date` values - columns derive from a date-fns format (12/24h, optional seconds, AM/PM), `minuteStep`/`secondStep`, roving-focus listbox columns with wrapping arrows and type-to-jump.
  - `et-time-input` (+ headless `[etTimeInput]`): string-valued form control (`TIME_FORMAT` token, default `HH:mm`) with lenient typed parsing (`930` → 09:30, `9pm`, `9.30`) and an anchored time-picker overlay that stays open across part picks.

### Patch Changes

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`56a38d5`](https://github.com/ethlete-io/ethdk/commit/56a38d5f68c3f4a5d866757de23e06d0662aae25) Thanks [@github-actions](https://github.com/apps/github-actions)! - Date & time inputs: the picker trigger buttons now have a 44px tap target (invisible hit-area extension, no visual change). Time picker: options gain visual hierarchy (muted until interacted, tinted roving anchor, column separators) and the columns keep a half-faded number at each edge as a scroll cue.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`1d8b757`](https://github.com/ethlete-io/ethdk/commit/1d8b7570f7d65a59616b99a93243b4ba7a9c9d53) Thanks [@github-actions](https://github.com/apps/github-actions)! - Icons: the `@ethlete/components:icons` generator no longer emits a `GENERATED_ICONS` aggregate array - spreading it into `provideIcons()` registered every icon and defeated tree shaking. Import the individual `IconDefinition` constants instead; re-running the generator removes the array from the generated file.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: anchored arrows (menu, tooltip, toggletip) now match the pane's actual background and border, so an arrow no longer stays a surface elevation too low when its pane sits on a raised surface (e.g. a menu opened from a filled form-field).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlays and menus now open on insecure origins (plain-HTTP pages on a LAN IP, not just `localhost`/HTTPS). Id generation used `crypto.randomUUID()`, which is `undefined` outside a secure context, so opening any dialog, sheet, anchored overlay or menu threw and only the backdrop appeared. A new `randomId()` helper in `@ethlete/core` uses `crypto.randomUUID()` when available and falls back to `getRandomValues` otherwise.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`00b7c33`](https://github.com/ethlete-io/ethdk/commit/00b7c337e5ae0ac1bfc7186237b1ac2879eb018d) Thanks [@github-actions](https://github.com/apps/github-actions)! - Theming: overlay panes (menu, select) now resolve their color context through passive providers and apply it before the first painted frame.
  - `ProvideColorDirective` gains `resolvedColor` - the color that actually applies at the provider's location, falling through passive providers like the CSS cascade does. `syncWithProvider` uses it, so a passive in-between provider (e.g. a form field's) no longer erases the theme inside a detached overlay pane.
  - The menu and select panels install the context sync during construction instead of in an effect, eliminating a wrong-theme flash during the enter animation.

- [#3025](https://github.com/ethlete-io/ethdk/pull/3025) [`416cfb8`](https://github.com/ethlete-io/ethdk/commit/416cfb8c3f370783a96b2fe59b827e981cac7b17) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay sheets: fix the black gap that appeared at the docked edge while a sheet sprang into view. The enter spring overshoots slightly past the docked edge, and the filler meant to cover that gap was an `::after` strip positioned just outside the host - which sheets clip away with their `overflow: hidden` (kept for the rounded corners), so nothing painted and the page background showed through (most visible with sheets whose surface is painted on nested content, e.g. the date picker). The filler is now a solid offset `box-shadow`, which is not clipped by the host's own overflow and needs no change to the corner clipping. Its color is measured from the sheet's actually-painted surface at open time, so it matches even when that surface sits on nested content one elevation above the container host (where the host's own surface token would be a shade off).

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`1fa8e45`](https://github.com/ethlete-io/ethdk/commit/1fa8e4543c976658d0fbee5902ce43b9418932c3) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the sidebar page component no longer triggers an `NG0912` component ID collision when `@ethlete/cdk` is loaded in the same app.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`9431073`](https://github.com/ethlete-io/ethdk/commit/9431073bb693aa10bbb84d5196597cb2c4b7463f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the selection (floating) toolbar is now a pointer-device-only enhancement. On touch it fought the platform's native selection menu (Copy/Paste/…) and appeared unreliably, so it is suppressed there - the always-visible static toolbar covers formatting on touch. Mouse/trackpad behavior is unchanged.

- [#3022](https://github.com/ethlete-io/ethdk/pull/3022) [`428f971`](https://github.com/ethlete-io/ethdk/commit/428f9718c96038a4aa9fee603b11ea341c7fe99b) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor fixes:
  - The table size picker now supports arrow-key navigation (Enter/Space inserts the selected size, Escape/Tab close the menu from a focused cell).
  - Toolbar buttons draw their focus ring on the button edge instead of 3px outside it, where it stacked on the field border and neighboring buttons.
  - Applying a link with Enter no longer leaks a line break into the editor.
  - Whitespace at the edges of the linked selection now stays outside the created anchor instead of being swallowed (e.g. the trailing space of a word selection).

## 1.0.0-next.21

### Minor Changes

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Menu: `et-menu-radio-item` and `et-menu-checkbox-item` take an optional `icon` input that renders a registered icon in place of the radio dot / checkmark (the checked state shows through the icon's accent color). The rich text editor's alignment and text-style menus now use icons this way.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`1d7aaca`](https://github.com/ethlete-io/ethdk/commit/1d7aacaec10f3d3d7278733ebf5d834e8a89b1f7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: add opt-in, tree-shakeable building-block autocomplete. Add the
  `etRichTextEditorTriggers` directive (with `RICH_TEXT_EDITOR_TRIGGERS_IMPORTS`) and pass triggers
  built with `createRichTextEditorTrigger` - typing a trigger char (e.g. `#`, `@`) opens a
  caret-anchored, menu-styled popup, and picking an item inserts an atomic `{{type:id}}` token chip.
  Item sources can be static, `Promise`, or `Observable`. Use `provideRichTextEditorTokenRendering(...)`
  to render stored token values as chips in read-only contexts, or `createRichTextEditorTriggerWithQuery(...)`
  to back a trigger with an `@ethlete/query` query (results, loading and error wired automatically).

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: added an opt-in **alignment** tool. Provide `provideRichTextEditorAlignmentTool()` and include `'align'` in the editor's `tools` to get a block-alignment menu (left / center / right / justify) that also works inside table cells. The button reflects the caret's current alignment live. Alignment has no Markdown form, so it persists as a native `text-align` style and round-trips as raw HTML.

  `@ethlete/core`: `markdownToHtml`/`htmlToMarkdown` now round-trip block elements carrying a `text-align` style (preserved verbatim as native HTML).

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`af660e3`](https://github.com/ethlete-io/ethdk/commit/af660e346204d18ad39cc700c8698bb897fba339) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: added **inline code** and **underline** formatting tools (in the static and selection toolbars, and the default toolbar). Inline code round-trips as `` `code` ``; underline is preserved as native `<u>` since Markdown has no underline form.

  `@ethlete/core`: `htmlToMarkdown`/`markdownToHtml` now round-trip `<u>` (underline) instead of dropping it.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: list items can now be nested. **Tab** nests the current item under the previous one, **Shift+Tab** lifts it out one level, and **Enter**/**Backspace** on an empty item step out one level at a time (leaving the list entirely only at the top level). Marker styles cycle by depth (disc → circle → square, and decimal → lower-alpha → lower-roman).

  `@ethlete/core`: `markdownToHtml`/`htmlToMarkdown` now round-trip **nested** lists (two-space indentation per level), instead of flattening them.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: Markdown autoformat while typing (opt out with `autoformat=false`). Line-start prefixes convert on space - `-`/`*`/`+` into a bulleted list, `1.` into a numbered list, `#`–`###` into a heading - and closing an inline run (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`, `__`/`_`) converts it into its mark with the caret placed after it. Autoformat is token-aware: registered trigger characters are reserved (a `#` trigger keeps opening its autocomplete instead of becoming a heading) and conversion is suspended while a trigger popup is open.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: pasted HTML is now normalized into the editor's own schema (foreign tags, inline styles, classes and scripts never enter the editable DOM; token chips keep their identity), and pressing Enter at the edge of a heading starts a plain paragraph instead of continuing the heading. Shift+Enter always stays a soft line break.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: the heading menu and list buttons now disable themselves while the caret is inside a table cell (a GFM table cell can only hold inline content, so block markup there would not survive serialization), instead of silently doing nothing. Custom tools can opt into the same behavior via the new `isDisabled` callback on `RichTextEditorToolDefinition`. The Cmd/Ctrl+U shortcut now runs through the editor's own underline command like the other formatting shortcuts.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: added an opt-in **table** tool. Provide `provideRichTextEditorTableTool()` and include `'table'` in the editor's `tools` to get a toolbar control that inserts a table via a grid-size picker and edits it (insert/delete rows and columns, delete table) when the caret is inside one. Tables round-trip as GFM pipe tables. The tool and its DOM operations are only referenced from the provider, so they tree-shake away when not used.

  Toolbar tools are now extensible: register a `RichTextEditorToolDefinition` (a toggle button or a custom control component) via the `RICH_TEXT_EDITOR_TOOL` multi-provider token.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`af660e3`](https://github.com/ethlete-io/ethdk/commit/af660e346204d18ad39cc700c8698bb897fba339) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: the toolbar is now configurable. A new `tools` input takes an ordered list of tool tokens (`'bold' | 'italic' | 'strike' | 'heading' | 'bulletedList' | 'numberedList' | 'link' | 'divider'`), and `provideRichTextEditorTools(...)` sets the default for a scope. The block style is now picked from a `heading` menu (Normal / Heading 1–3) shown first in the toolbar, and toolbar buttons are larger and squarer.

  Form field: read-only text controls (`et-input`, `et-rich-text-editor`) now keep their normal box but drop all interactive affordances - no hover/focus border change, default cursor - so read-only reads as view-only content, distinct from disabled.

  Icon button: added an `--et-icon-button-border-radius` custom property so an ancestor context (e.g. a toolbar) can square off the otherwise fully-round button.

  Overlay (`@ethlete/core`): anchored overlay positions accept an optional `boundary`, so an anchored pane (e.g. the editor's selection toolbar) can be kept inside a region and flip instead of overflowing it.

### Patch Changes

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`1d7aaca`](https://github.com/ethlete-io/ethdk/commit/1d7aacaec10f3d3d7278733ebf5d834e8a89b1f7) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add `injectAnimatedBlockSize` - a core util that smoothly animates an element's `block-size` as its
  content resizes (baseline captured on first render so the initial layout never plays as a
  grow-from-0, interruption-safe, respects `prefers-reduced-motion`). `et-menu` and the rich text
  editor's trigger popup now share it, giving a more consistent, smoother resize.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Form field: the disabled treatment (dimmed frame, blocked pointer events, hint color) is now driven by the registered control's disabled state via a `data-disabled` host attribute instead of `:has(:disabled)` - a composite control like the rich text editor can disable individual toolbar buttons without the whole field being dimmed and made unclickable.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`7e4c883`](https://github.com/ethlete-io/ethdk/commit/7e4c8832493b8c8b505efd80acfa147d90bc9523) Thanks [@github-actions](https://github.com/apps/github-actions)! - Form field: only a `filled` field raises the surface elevation for its contents - a `transparent` field now stays flush with its parent surface instead of bumping elevation without a painted background.

  Rich text editor: the autocomplete popup no longer renders one elevation too high (it now matches menus), and its "source failed" error state is a centered icon-and-message panel instead of a stray line in an empty box.

  Rich text editor: token chips (merge fields, mentions) now render as a tonal accent pill with a hairline ring - and keep their trigger char (`@`, `#`, …) visible as a de-emphasized prefix - so they read clearly as distinct entities in the prose, instead of a faint neutral highlight.

  Rich text editor: the selection formatting toolbar now mounts through the overlay system (like the autocomplete popup) instead of a manually-positioned fixed element - so it shares the same anchoring, stacking, theming, and enter/leave animation.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`d362747`](https://github.com/ethlete-io/ethdk/commit/d3627470bddd16a6b76577ac8d3dc43d9d7fdd2e) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the anchored arrow now matches the pane it points at - it paints the
  pane's actual background and mirrors its border (including no border when the
  pane has none), instead of re-deriving a color from surface tokens that could
  diverge from a custom `panelClass` or themed pane.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay: apps using both `@ethlete/components` and `@ethlete/cdk` no longer log `NG0912` component ID collision warnings on bootstrap.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: the alignment tool now applies to the whole table column (GFM alignment is per column, so a single aligned cell would not survive serialization) and disables itself inside lists, where alignment has no serialized form. Lists swept up by a cross-block selection are skipped instead of receiving a lost `text-align`.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`bf72655`](https://github.com/ethlete-io/ethdk/commit/bf7265505ecaf77f2bc239fd945f763655af5b82) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: toggling an inline format (bold, italic, underline, strike, code) with **no selection** now works as expected - it sets a pending "stored mark" so the next typed text picks up (or drops) that formatting, instead of doing nothing. The pending state shows in the toolbar and is cleared when you move the caret.

- [`c829986`](https://github.com/ethlete-io/ethdk/commit/c82998628a487effe34d2061811f3cee0fa4f7bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Rich text editor: block alignment is no longer lost when re-tagging between paragraph and heading, and the heading menu now disables itself inside list items (where a heading has no serialized form), matching the table-cell behavior.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`e06f250`](https://github.com/ethlete-io/ethdk/commit/e06f250aec6997bf34dacef00e8cdcb9ce1d8819) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: fixed formatting a selection then applying a heading dropping the inline mark (e.g. bold text turned into a heading lost its `<strong>`), and a follow-up fix so the first toggle-off click after a block-level command actually removes the mark instead of no-op-ing.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: pressing ArrowRight at the end of an inline code span (or ArrowLeft at its start) now steps the caret outside the code, so continuing to type isn't code.

- [#3019](https://github.com/ethlete-io/ethdk/pull/3019) [`c68d2b2`](https://github.com/ethlete-io/ethdk/commit/c68d2b2e2e64316bb67bf58ec16d3aad9bd84f34) Thanks [@github-actions](https://github.com/apps/github-actions)! - Rich text editor: table editing polish - arrow keys now step the caret cleanly across table edges (into the nearest cell when entering, onto a real line when exiting, adding one only when the table is flush against the editor's top/bottom) instead of stranding it at the table border; an empty line directly above a table can be removed with Backspace; and applying an inline format across multiple selected cells now wraps each cell's content within its own cell instead of tearing the table apart.

## 1.0.0-next.20

### Major Changes

- [`44adcac`](https://github.com/ethlete-io/ethdk/commit/44adcac94d7e0f56742e02901221c6e04da7df47) Thanks [@TomTomB](https://github.com/TomTomB)! - Rename past-tense outputs to the present tense, matching native DOM event naming (enforced by the new `ethlete/prefer-present-tense-output` lint rule):
  - `etMenuItem` (and `et-menu-item` / `et-menu-checkbox-item` / `et-menu-radio-item`): `activated` → `activate`
  - `etDropzone` / `et-dropzone`: `filesRejected` → `filesReject`, `uploadSucceeded` → `uploadSucceed`, `uploadFailed` → `uploadFail`
  - `et-grid-item`: `removed` → `remove`

  Update the corresponding template bindings, e.g. `(activated)` → `(activate)`, `(uploadSucceeded)` → `(uploadSucceed)`, `(removed)` → `(remove)`.

### Minor Changes

- [#3018](https://github.com/ethlete-io/ethdk/pull/3018) [`e8f9bcd`](https://github.com/ethlete-io/ethdk/commit/e8f9bcd65b40724b266aff8949951649afafea36) Thanks [@github-actions](https://github.com/apps/github-actions)! - Move all component styles into the `components` CSS cascade layer (`@layer components`).

  Component CSS was previously injected unlayered, which meant it beat Tailwind
  utility classes (in `@layer utilities`) regardless of specificity - forcing
  consumers to reach for `!important` (e.g. `flex!`) to override layout, spacing or
  sizing on components. Because layer precedence is resolved before specificity,
  `:where()` could not fix this.

  Now that component rules live in `@layer components` (which Tailwind v4 orders
  before `utilities`), a plain utility class overrides component styles without
  `!important`. This is a behavior change: any consumer rule that is unlayered or
  in a later layer now wins over component styles by default. Apps using the
  default Tailwind v4 layer order (`theme, base, components, utilities`) get the
  fix automatically; apps that customize layer order should ensure `components`
  sorts before their utilities.

## 1.0.0-next.19

### Patch Changes

- [`09ed801`](https://github.com/ethlete-io/ethdk/commit/09ed8010644643a7f019652f986d8454a4cdbdb3) Thanks [@TomTomB](https://github.com/TomTomB)! - Icon button & FAB: sizes now match the surface button's height at every size (`xs`–`xl`), so they line up in a row.

- [#3017](https://github.com/ethlete-io/ethdk/pull/3017) [`4913e22`](https://github.com/ethlete-io/ethdk/commit/4913e226918ab5200b500620bae37c063af0e7ca) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay arrows: anchored-overlay arrows (menu, tooltip, toggletip) now take their background and border from the surface theme by default, so the arrow border stays visible and matches the panel under any theme. Override via `--et-overlay-arrow-background` / `--et-overlay-arrow-border`.

## 1.0.0-next.18

### Major Changes

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`bd4a07f`](https://github.com/ethlete-io/ethdk/commit/bd4a07f6e718ed637a6e9f0d54b0c2dbfae37236) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: replace the curried overlay handler API with an explicit define/create pair, and merge overlay configs additively instead of replacing them.
  - `createOverlayHandler` and `createOverlayHandlerWithQueryParamLifecycle` are removed. Define an overlay once at module scope with `defineOverlay({ component, ...config })` (or `defineQueryParamOverlay({ component, queryParamKey, ...config })` for URL-driven overlays), then create an opener in an injection context with `createOverlayOpener(definition, { afterClosed, ...config })`.
  - Overlay configs now merge additively across definition → opener → per-open layers: `bindings`, `providers`, `hostClass`, `backdropClass` and `panelClass` are concatenated instead of the most specific layer silently replacing the rest; scalar options still follow most-specific-wins. The merge is exposed as `mergeOverlayConfigs(...configs)`.
  - Inside the overlay component, access the typed ref via `definition.injectRef()` (replaces the handler's `injectOverlayRef`). It throws an actionable `RuntimeError` when called outside an open overlay.
  - `defineQueryParamOverlay` requires the component to expose an `overlayQueryParam` model at compile time (previously a silent runtime requirement), and the opener's `open(value)` is typed from that model's value type. Definition- and opener-level `bindings`/`providers` are now applied on every URL-driven open, so components with additional inputs work with query-param overlays.
  - `OverlayHandlerLinkDirective` (`etOverlayHandlerLink` + `etOverlayHandlerQueryParamName`) is replaced by `QueryParamOverlayLinkDirective`: `<a [etQueryParamOverlayLink]="definition" etQueryParamOverlayLinkValue="42">` - the link takes the definition object, so the query param key is no longer duplicated as a string.

  Migration:

  ```ts
  // before
  const openProductOverlay = createOverlayHandlerWithQueryParamLifecycle<ProductOverlayComponent>({
    component: ProductOverlayComponent,
    strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
    queryParamKey: 'product',
  });
  // in a component
  handler = openProductOverlay();

  // after
  export const productOverlay = defineQueryParamOverlay({
    component: ProductOverlayComponent,
    strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
    queryParamKey: 'product',
  });
  // in a component
  opener = createOverlayOpener(productOverlay);
  ```

### Minor Changes

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`2f18e43`](https://github.com/ethlete-io/ethdk/commit/2f18e4344759dbbcd17ba0dbeca138f1f7043cdf) Thanks [@github-actions](https://github.com/apps/github-actions)! - Anchored overlays: the `shift` option now also accepts `{ crossAxis?: boolean }` in addition to a boolean. With `crossAxis: true`, an overlay that fits on neither side of its reference is shifted along the placement's cross axis to stay inside the viewport (it may then overlap the reference) instead of overflowing off-screen.

  Menus enable this by default: a nested submenu near the viewport edge first flips to the other side and, when neither side fits, slides over its parent menu - matching native OS menu behavior - instead of being cut off by the viewport.

  The `size` middleware (`autoResize`) now runs after `shift` instead of before it, so `--et-overlay-max-width` / `--et-overlay-max-height` are measured from the pane's shifted position. Previously a cross-axis-shifted pane had its max size capped to the unshifted leftover space, squeezing e.g. a submenu to a sliver instead of letting it keep its width while overlapping its parent.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`789d765`](https://github.com/ethlete-io/ethdk/commit/789d765e1342f92d1269f1d8a1dbb64e28415708) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-dropzone` file-upload control with a built-in `@ethlete/query` upload workflow. Import `DROPZONE_IMPORTS`.
  - Files are picked via click or drag & drop and uploaded through a consumer-provided query, one query per file. Configure with `createDropzoneUpload({ queryCreator, selectValue, createArgs?, resolveExisting? })` - `selectValue` maps the upload response to the form control value (e.g. `(media) => media.uuid`).
  - Signal-forms native (`[formField]`): the control value holds the values of successful uploads (and existing entries) in entry order - `TValue | null` in single mode, `TValue[]` with `multiple`. In-flight and failed uploads never enter the value; block submits via the headless `anyUploading` signal.
  - Built-in UI: per-file progress bars (requires `reportProgress: true` on the query creator and the XHR `HttpClient` backend; degrades to indeterminate otherwise), image previews via object URLs, remove/replace/retry via regular icon buttons, and enter/leave animations (FLIP shift plus scale-out on delete, disabled under `prefers-reduced-motion`). In single mode a successful upload replaces the drop area with a same-size preview (no layout shift).
  - Validation lives in the form schema: `required()`/`minLength()`/`maxLength()` cover emptiness and file count, and the new `dropzoneFiles()` schema rule declares file constraints (`accept`, `maxFileSize`, `minFileSize`). Violating files never upload - each violation becomes a regular validation error on the field (customizable via the rule's `message` function) and is emitted via `filesRejected`. Upload failures render as validation-style messages below the field (`uploadErrorMessage` input).
  - Edit forms: values already present in the control render as entries via the `resolveExisting` display resolver.
  - Full behavior is available headlessly via the `etDropzone` directive (`entries()`, `lastRejections()`, `selectFiles()`, `removeEntry()`, `retryEntry()`, `clear()`, `isDragOver`, …). Error codes `ET2400`–`ET2499`.

  Icons: new built-in `UPLOAD_ICON` (`et-upload`), `FILE_ICON` (`et-file`) and `ROTATE_RIGHT_ICON` (`et-rotate-right`) definitions. The dev-mode icon color validation now allows `fill="none"` / `stroke="none"` (only actual hardcoded colors are rejected).

  **`@ethlete/components` now has a peer dependency on `@ethlete/query`** (`^6.0.0-beta.8`).

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid & Tabs: the previously allocated error codes are now actually enforced, and a nav-tabs composition bug is fixed.
  - Tabs (dev mode): `ET2000` when a tab trigger has no enclosing tab bar, `ET2001` when `<et-tab>` / `etTabPanel` sit outside a tab group (an orphan `<et-tab>` used to disappear silently), `ET2002` when a headless tab group has triggers but no panels, `ET2003` when nav-tab pieces are used without `et-nav-tabs`.
  - Grid (dev mode): `ET1900` for items outside a grid, `ET1901` for drag/resize handles outside a grid item, `ET1902` for duplicate item ids, `ET1903` when `restoreState()` receives unknown breakpoint names, and the new `GRID_ERROR_CODES.UNKNOWN_ITEM_TYPE` (`ET1904`) when an item's `type` has no registration - previously such items were silently dropped.
  - Fixed: `<et-nav-tabs-outlet>` placed as a sibling of `<et-nav-tabs>` (the documented composition) crashed with a DI error. It now resolves the tab bar that labels it automatically when exactly one `et-nav-tabs` exists on the page, and still prefers an ancestor tab bar when nested.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: trigger-anchored root menus now render a floating arrow pointing at their trigger, matching the tooltip and toggletip look. The new `arrow` input on `[etMenu]` (default `true`) controls it - set `[arrow]="false"` to opt out - and `arrowPadding` (default `8`) tunes how close the arrow may get to the panel corners. Submenus and context menus (point-anchored) never render an arrow.
  - With the arrow enabled, the `'auto'` offset resolves to `10` so the arrow has room between the panel and its trigger; disabling the arrow restores the previous tight spacing. Submenu and context menu spacing is unchanged.
  - The arrow picks up the menu surface theme (`--et-surface-background-solid` / `--et-surface-border-solid`) and can be overridden via `--et-overlay-arrow-background` and `--et-overlay-arrow-border`.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`2f18e43`](https://github.com/ethlete-io/ethdk/commit/2f18e4344759dbbcd17ba0dbeca138f1f7043cdf) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the menu now fully respects the surface and color theming systems instead of shipping a hardcoded dark palette.
  - Borders, separators, muted text (group labels, shortcuts, the search placeholder/spinner) and the search input fill now derive from the surface tokens (`--et-surface-border-solid`, `--et-surface-color-muted-solid`, `--et-surface-interaction-solid`).
  - The active menu item highlight is now a `color-mix` tint of `--et-surface-interaction-solid` instead of a fixed white overlay.
  - The menu panel resolves its surface via `AutoSurfaceDirective`, automatically picking the next elevation relative to the trigger's surface context.
  - Destructive menu items and the search error message now use the app's registered `error` color theme (via `injectErrorTheme()`), so `--et-theme-color-primary-*` resolves to the error palette inside them. The `--et-menu-item-destructive-color` token has been removed - theme the error color theme instead. Like `et-form-field`, `et-menu` now requires color themes (including one with `type: 'error'`) to be registered.
  - Selection item check/radio marks and the search input focus border now use `--et-theme-color-primary-solid` from the surrounding color theme context.
  - The active-item highlight now only shows for an actual hover or `:focus-visible` (keyboard) interaction - opening a menu with the mouse no longer highlights the first item, while keyboard-opened menus still do. A trigger item whose submenu is open stays highlighted via `[data-menu-open]`.
  - The menu animates its block size (160ms) when its content changes while open - e.g. search filtering items away or the search error line appearing - instead of snapping to the new size. Respects `prefers-reduced-motion`.
  - Menu items now have a pressed (`:active`) state - a stronger tint of the surface interaction color (20% vs the 12% highlight) - and transition `background`, `color` and `opacity` (120ms) between their rest, highlighted, pressed and disabled states. The search input transitions its `border-color` and `background`, matching the button's interaction feel.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`8d5c7dc`](https://github.com/ethlete-io/ethdk/commit/8d5c7dce47c0b04592ebe366354871f177d55f0a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: visual refresh and new options for the selection controls (checkbox group, radio group, segmented button group, switch, choice field).
  - Checkbox options and radios: option labels now render in the regular text color at a fixed size, boxes/circles gained hover tint fills, press feedback and a draw-in checkmark animation; the group label is styled like a form-field label (new `--et-<group>-group-label-font-size` tokens).
  - Selection-list groups (`et-checkbox-group`, `et-radio-group`, `et-segmented-button-group`) now support a projected `<et-label>` as group label - it shows the required marker (`*`) and wires `aria-labelledby` automatically. The plain `.et-<group>-label` span still works for label text without the marker.
  - Segmented button group: redesigned as a tonal track with a filled active pill that animates between options (flip animation). `--et-segmented-button-border-width` was removed; new tokens `--et-segmented-button-border-radius`, `--et-segmented-button-group-track-padding`, `--et-segmented-button-group-track-radius` and `--et-segmented-button-group-label-font-size`.
  - Switch: reworked visuals - the off state uses a neutral tinted track with a smaller muted thumb that grows and slides on toggle, plus a press-stretch effect. Default dimensions changed to a 40×22px track with a 16px thumb.
  - New `size` input (`'sm' | 'md' | 'lg'`, default `'md'`) on `et-checkbox-group`, `et-radio-group`, `et-segmented-button-group` and `et-choice-field`, scaling controls, labels and gaps in line with `et-form-field` sizes.
  - Group error states now tint the unchecked control borders with the error color (previously only the error message was colored).
  - The control CSS tokens (`--et-checkbox-*`, `--et-checkbox-option-*`, `--et-radio-*`, `--et-segmented-button-*`, `--et-switch-*`) are now registered as inheriting custom properties, so overriding them on the component or a wrapper actually reaches the inner elements that consume them.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`6e9693a`](https://github.com/ethlete-io/ethdk/commit/6e9693a9352d19775f46ab5424cbdea455a14ee5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Button: new split button. `<et-split-button>` groups an action segment (`etSplitButtonAction`) and a trigger segment (`etSplitButtonTrigger`) - both regular surface/icon buttons - into one `role="group"` control with joined corners and a divider between the segments.
  - The segments keep the full button API (variant, size, color, disabled, loading); the trigger typically also carries `etMenuTrigger` to open a menu with related actions.
  - The divider color is themeable via `--et-split-button-divider-color` (defaults to `currentColor` at 32%).
  - The headless `SplitButtonDirective` (`[etSplitButton]`) plus the segment directives are exported for custom-styled split buttons.
  - Missing or misplaced segments throw dev-mode errors in the new `ET23xx` range.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: theming overhaul and cleanups.
  - The PiP chrome now provides a surface theme scope (`type: 'dark'`, elevation 1) - it is mounted into `document.body` and previously had no theme context at all.
  - The PiP window glass background derives from the surface theme (`60%` of `--et-surface-background-solid`) instead of hardcoded `rgba(0, 0, 0, 0.6)`; `--et-pip-bg` remains as an override hook but is no longer a registered `@property`.
  - The featured-cell ring in PiP grid mode uses `--et-theme-color-primary-solid` instead of hardcoded `#3b82f6`; `--et-stream-pip-chrome-featured-ring-color` remains as an override hook (no longer a registered `@property`). The hover ring and resize handles now derive from surface tokens too.
  - Scrollable: `ScrollableErrorCode` is removed in favor of `SCROLLABLE_ERROR_CODES`, matching every other domain's naming.
  - Internal: platform iframes set the legacy `scrolling` attribute via the renderer instead of the deprecated DOM property.

### Patch Changes

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`eabe123`](https://github.com/ethlete-io/ethdk/commit/eabe123414ec3cb39ed8bc1acdb3446599eeb0d6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Error codes: resolve a range collision where tabs, scrollable, and form field reused the icon domain's `ET18xx` codes. Each domain now owns a unique 100-code block:
  - Tabs: `TAB_ERROR_CODES` moved from `1800–1803` to `2000–2003`.
  - Scrollable: `ScrollableErrorCode.MISSING_SCROLL_CONTAINER` moved from `1800` to `2100`.
  - Form field: `FORM_FIELD_ERROR_CODES.MISSING_CONTROL` moved from `1800` to `2200`.

  Icon keeps `1800–1899`. If you match on these numeric values (or on `ET1800`-style codes in error messages), update to the new numbers.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`57f0e15`](https://github.com/ethlete-io/ethdk/commit/57f0e1542871ec39efd928e5f575ef5bad103269) Thanks [@github-actions](https://github.com/apps/github-actions)! - Icon button: fix the icon size not scaling with the button `size`. The icon was
  stuck at 20px for every size because the `--_et-icon-button-icon-size` custom
  property was registered as non-inheriting while being set on the button host and
  read on the nested icon element. Icons now scale correctly across `xs`–`xl`. The
  same fix is applied to the window control button icon.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`7110a06`](https://github.com/ethlete-io/ethdk/commit/7110a068208586f5906da1fc387c5181b2d1ec1a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the floating arrow no longer affects or overlaps the panel content.
  - The overlay arrow is now clipped at the panel edge (it only keeps the outer tip plus the border seam), so the menu no longer adds extra clearance padding on the arrow side - padding is identical regardless of placement.
  - `arrowPadding` on `[etMenu]` now defaults to `14` (was `8`) so the arrow can no longer slide into the panel's rounded corners.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`90eeba1`](https://github.com/ethlete-io/ethdk/commit/90eeba1e6dbac11cfaef7cd4c2f0a5fa6234d642) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the anchor arrow no longer overlaps the panel's edge content. The rotated
  arrow dips into the panel edge nearest the trigger, which previously cut into the
  search field (panel below the trigger) or the first/last menu items (panel above
  the trigger). The adjacent content now keeps clear of the arrow.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the anchored overlay arrow (tooltip, toggletip, anchored dialog) no longer flashes for a frame before the enter animation starts. The arrow now stays hidden while the overlay is still waiting to animate in, instead of briefly appearing, disappearing, and fading in again.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: accessibility fixes for the built-in overlays and self-created player iframes.
  - The iframes created by the Kick, SOOP, Dailymotion and TikTok players now carry a descriptive `title` (`"<Platform> player"`). YouTube, Vimeo, Twitch and Facebook iframes are created by the platform SDKs and cannot be titled from the library.
  - The loading overlay is now a `role="status"` region labelled "Loading", the error overlay announces itself via `role="alert"`, and the consent gate is a `role="group"` labelled by its heading.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Text button: the underline is no longer shown in the resting state - it now animates in on hover, focus and press, and sits tight under the label (link-style) instead of hanging below the button's line box. Resting text buttons now align optically with neighboring buttons of the same size.

## 1.0.0-next.17

### Major Changes

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay: replace the `inputBindings` / `outputBindings` config objects with a
  single `bindings` array using Angular's native binding API. Bind overlay
  component inputs, outputs, and two-way models with `inputBinding`,
  `outputBinding`, and `twoWayBinding` from `@angular/core`.

### Patch Changes

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix icon directive typing and improve the icon generator config.
  - `IconDirective` now explicitly annotates its inputs as `InputSignal<RegisteredIconName>` and `InputSignal<RegisteredIconVariant | undefined>`. Without the annotation the d.ts bundler inlined the registry aliases to `string`, so consumer-side `declare module` augmentation of `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` had no effect. `etIcon`/`variant` are now actually narrowed to the registered names.
  - The `@ethlete/components:icons` generator config takes a top-level `variants` list (replacing the singular `defaultVariant`). Bare string entries - and object entries without their own `variant`/`variants` - inherit it, so a set of icons that all share a style no longer needs the variant repeated on every entry.
  - The generator's `source: "auto"` sentinel is now honored when set in the config file (previously only the CLI default auto-detected; a config `"auto"` was treated as a package literally named "auto").

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay routing: a shell that wraps only the router outlet (each route carries its own `et-overlay-main` with header/body/footer) now reliably bounds the outlet to the pane. The shell content grid pins both axes (`grid-template-columns`/`grid-template-rows: minmax(0, 1fr)`), so the outlet fills a fixed-height dialog and the routed page's body scrolls with its header and footer pinned - instead of the whole overlay scrolling. The `minmax(0, ...)` column also stops a wide child (e.g. a rich-text editor) from blowing the grid past the pane width.

## 0.1.0-next.16

### Minor Changes

- [`89a1d38`](https://github.com/ethlete-io/ethdk/commit/89a1d383cea36583c9459bd13e6c41ec25e0ecb7) Thanks [@TomTomB](https://github.com/TomTomB)! - Add icon variants and an icon generator.
  - `IconDefinition` gains an optional `variant`, and `provideIcons` now keys the registry by name + variant, so the same icon name can exist in multiple styles.
  - `IconDirective` gains a `variant` input: `<i etIcon="shield" variant="light">`. When omitted it matches a variant-less icon first, then falls back to the `solid` variant.
  - `etIcon` and `variant` are now typed against the augmentable `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` interfaces (they stay `string` until augmented).
  - New `@ethlete/components:icons` generator reads a small config, auto-detects an installed SVG source (Font Awesome pro then free), and generates `IconDefinition` constants plus a `.d.ts` that augments the registries. Run with `nx g @ethlete/components:icons`.

### Patch Changes

- [`ea1eb65`](https://github.com/ethlete-io/ethdk/commit/ea1eb656b4f1144602830a3cd27a521ca50a9d06) Thanks [@TomTomB](https://github.com/TomTomB)! - Theming: add `AutoSurfaceDirective` (`etAutoSurface`), which resolves the surface
  theme one elevation above its parent (or an explicitly provided) surface context
  and applies it through a host `ProvideSurfaceDirective`. Meant to be used as a
  host directive on components that render inside a detached overlay pane, where
  surface context can't cascade through the DOM.

  Tooltip and toggletip now use `AutoSurfaceDirective` as a host directive instead
  of duplicating the auto-surface resolution logic. No change to their rendered
  surface.

- [`efe9cc3`](https://github.com/ethlete-io/ethdk/commit/efe9cc30b61245fd3c7fd1eaeedc3be7b85ed275) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: prevent text selection inside a grid item when dragging it in
  non-readonly mode. `user-select` is now disabled on the item content whenever the
  grid is editable, instead of only after a drag has committed - so the initial
  pointer movement before the drag threshold no longer selects the item's text.

- [`70308a7`](https://github.com/ethlete-io/ethdk/commit/70308a7e0ce81d97c91d55fb7f619f1384a0e3bc) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay routing: support routes that nest their own `et-overlay-header`/`et-overlay-body`/`et-overlay-footer` (a full `et-overlay-main`) directly inside the router outlet, without a shared shell or sidebar. Previously the active route grew past the overlay, pushing the footer off-screen and preventing the body from scrolling.
  - The router-outlet content wrapper now propagates a bounded height, so each route's body scrolls with its header and footer pinned. Combine with a fixed dialog height to keep a stable size across navigation.
  - On navigation, focus now moves to the first sensible element of the new page (first-tabbable, so buttons/inputs win over headings), mirroring the overlay's open-time `autoFocus` behaviour and respecting the configured `autoFocus` (including `false`). It falls back to the page container when the page has nothing tabbable.
  - Removed the stray focus outline that appeared around the whole modal on window blur/refocus, caused by the programmatically focused page container.

## 0.1.0-next.15

### Minor Changes

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: layout changes are now animated. The container height transitions smoothly as items are added, removed, or reflowed, and items animate on enter and leave instead of snapping. Animations are automatically disabled during the initial render and while the container width is settling (e.g. on resize) so placement never animates unexpectedly, and are fully suppressed for users who prefer reduced motion. Animation duration is tunable via the `--et-grid-anim-duration` custom property.

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: dragging an item near the edge of a scrollable ancestor now auto-scrolls the container, so items can be moved to positions that are off-screen without letting go. The scroll speed ramps up with edge proximity and stops as soon as the drag ends.

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add a new `Menu` component and headless menu primitives. It provides a fully accessible, overlay-anchored menu system built on the styled components `MenuComponent` (`et-menu`), `MenuItemComponent` (`et-menu-item`), `MenuItemShortcutComponent` (`et-menu-item-shortcut`), `MenuSeparatorComponent` (`et-menu-separator`), `MenuGroupLabelComponent` (`et-menu-group-label`), and the selection components `MenuRadioGroupComponent` / `MenuRadioItemComponent` and `MenuCheckboxGroupComponent` / `MenuCheckboxItemComponent`. All are bundled in `MenuImports`.

  Highlights:
  - Open a menu from any element with `etMenuTrigger`, nest submenus, and open at the pointer as a right-click context menu with `etMenuContextTrigger`.
  - Full keyboard support with roving focus, typeahead, and configurable hover intent so submenus don't flicker on diagonal pointer movement.
  - Single- and multi-select groups (`radio` / `checkbox` semantics) via `etMenuSelectionGroup` / `etMenuSelectionItem`.
  - Built-in filtering with `input[etMenuSearch]`, including async search sources.
  - Headless directives (`etMenu`, `etMenuPanel`, `etMenuItem`, `etMenuTrigger`, `etMenuContextTrigger`, `etMenuSelectionGroup`, `etMenuSelectionItem`, `etMenuSurface`, `input[etMenuSearch]`) are exported for building custom menu UIs.

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: add `overlayRef.updatePositionStrategy(strategy)` to re-apply positioning with a new strategy without remounting the overlay. Useful for repositioning an open overlay (e.g. moving an anchored menu to a new reference or point). Note that a strategy-controller breakpoint switch will override this with its own strategy again.

### Patch Changes

- [#3013](https://github.com/ethlete-io/ethdk/pull/3013) [`3f2eaad`](https://github.com/ethlete-io/ethdk/commit/3f2eaadf324bc6962a78efd2be1b7935106cc423) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid: rework drag and resize on a unified pixel/span geometry model so the live preview, the clamped pixel rect, and the snapped grid position can no longer disagree. This fixes item drift and overlap during fast drags and resizes near the grid bounds, keeps items within their configured min/max span constraints, and makes a drag snap to the pointer on commit instead of trailing it by the drag threshold.

- [`4e9f2b4`](https://github.com/ethlete-io/ethdk/commit/4e9f2b4d12335fafef192350aef8ffc584996a91) Thanks [@TomTomB](https://github.com/TomTomB)! - Remove the now-redundant `changeDetection: ChangeDetectionStrategy.OnPush` declaration (and its `ChangeDetectionStrategy` import) from all components. OnPush is the default change detection strategy since Angular 22, so this is a no-op cleanup with no behavioral change.

## 0.1.0-next.14

### Minor Changes

- [#3002](https://github.com/ethlete-io/ethdk/pull/3002) [`6bf6d5c`](https://github.com/ethlete-io/ethdk/commit/6bf6d5cd11ed546b412abb93f518a60b4e09f857) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add heading options to rich text editor toolbar

## 0.1.0-next.13

### Minor Changes

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: replace the built-in `✕` remove button and its `showDefaultRemoveAction` config option with `GridItemDefaultActionsComponent` (`et-grid-item-default-actions`) - a toolbar with an icon remove button that is now rendered by default. It is used automatically when the grid config leaves `actionsComponent` unset; set `actionsComponent` to your own component to replace it, or to `null` to render no actions. Its aria label is configurable via the new `removeActionAriaLabel` grid config option (defaults to `'Remove item'`, run through `transformer`).

  Also removes the now-redundant drag-handle slot: the `dragHandleComponent` config option, the `dragHandleAriaLabel` config option, and the `etGridItemDragHandle` projection slot are gone. With whole-item drag the item content is the drag surface, so a dedicated handle is no longer needed - project a decorative grip into the item content instead.

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: add `GridItemToolbarComponent` (`et-grid-item-toolbar`), a themeable container for per-item controls (edit, remove, …). Drop it into an item's action slot and project action buttons (e.g. `IconButtonComponent`) into it. It stops pointerdown so the toolbar is never a drag surface even when the whole item is draggable, and is themeable via the `--et-grid-item-toolbar-background` / `-gap` / `-padding` / `-radius` custom properties. Exported from the grid entrypoint and included in `GridImports`.

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: in edit mode the whole item is now a drag surface - a pointerdown anywhere on the item content starts a drag, instead of only the drag handle slot. Interactive overlays (the actions slot, resize handles, or anything that stops propagation such as `GridItemToolbarComponent`) still win, and read-only grids keep their content inert. Also fixes the `et-grid--readonly` class never being applied to the grid host, so the intended read-only styles (non-interactive drag handle, hidden resize handles) now take effect, and adds a grab/grabbing cursor on the content while editing.

## 0.1.0-next.12

### Minor Changes

- [`edea44b`](https://github.com/ethlete-io/ethdk/commit/edea44bf1c494420f02b545202f4b24db9a6395c) Thanks [@TomTomB](https://github.com/TomTomB)! - Update to angular 22

## 0.1.0-next.11

### Minor Changes

- [#2999](https://github.com/ethlete-io/ethdk/pull/2999) [`4a711fb`](https://github.com/ethlete-io/ethdk/commit/4a711fb9ce0acf53cd8fa71ce883520a79469563) Thanks [@github-actions](https://github.com/apps/github-actions)! - Port over overlays to components lib

- [`2a37d6d`](https://github.com/ethlete-io/ethdk/commit/2a37d6dc75cafb8af06c0912dffcdc67eca63086) Thanks [@TomTomB](https://github.com/TomTomB)! - Add floating toolbar to rich text editor

## 0.1.0-next.10

### Patch Changes

- [`c52eb0b`](https://github.com/ethlete-io/ethdk/commit/c52eb0b80d79b30a8cd40584734c471c217565c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix muted until pressed style on buttons

- [`c52eb0b`](https://github.com/ethlete-io/ethdk/commit/c52eb0b80d79b30a8cd40584734c471c217565c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix minor formatting issues in rich text editor

## 0.1.0-next.9

### Minor Changes

- [#2995](https://github.com/ethlete-io/ethdk/pull/2995) [`5ca2461`](https://github.com/ethlete-io/ethdk/commit/5ca246117f43bac39ef73204c0e37871bad9781f) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add basic rich text editor

## 0.1.0-next.8

### Minor Changes

- [`7dcbb8e`](https://github.com/ethlete-io/ethdk/commit/7dcbb8e3f3823728bc370fb89d1a89ee831e779b) Thanks [@TomTomB](https://github.com/TomTomB)! - Support surface theming in grid

## 0.1.0-next.7

### Patch Changes

- [`256b1b0`](https://github.com/ethlete-io/ethdk/commit/256b1b02d7598a0a6540af55447799a8ced469c4) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix grid overlapping items with invalid base config

## 0.1.0-next.6

### Patch Changes

- [`6ee86dc`](https://github.com/ethlete-io/ethdk/commit/6ee86dc6e2dde7ec6661d12e92fe1ceb87bc5800) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix grid edge cases

## 0.1.0-next.5

### Patch Changes

- [`b73a127`](https://github.com/ethlete-io/ethdk/commit/b73a127002a06e3aa0c4e7e977b1ad1f3e04e7e6) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump yet again, final one for sure, pinky promise

## 0.1.0-beta.4

### Patch Changes

- [`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766) Thanks [@TomTomB](https://github.com/TomTomB)! - Bump to beta

- Updated dependencies [[`ddb5d09`](https://github.com/ethlete-io/ethdk/commit/ddb5d09e4bc56e18cc8c228aa78a200441e7a766)]:
  - @ethlete/core@5.0.0-beta.11

## 0.1.0-next.3

### Patch Changes

- [`a690217`](https://github.com/ethlete-io/ethdk/commit/a6902172efd9bd1956a16237e79acbfbd816d946) Thanks [@TomTomB](https://github.com/TomTomB)! - Version bump only

## 0.1.0-next.2

### Minor Changes

- [`5d1d3ac`](https://github.com/ethlete-io/ethdk/commit/5d1d3accbd4a7657bc50cdc0653a7ca24fe761e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add tab and nav tab components

- [#2966](https://github.com/ethlete-io/ethdk/pull/2966) [`66d428d`](https://github.com/ethlete-io/ethdk/commit/66d428d14482e127972b0e0c6d6a5058800c7871) Thanks [@TomTomB](https://github.com/TomTomB)! - Add grid components

- [`5d1d3ac`](https://github.com/ethlete-io/ethdk/commit/5d1d3accbd4a7657bc50cdc0653a7ca24fe761e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add variants to icon and fab buttons

- [`5d1d3ac`](https://github.com/ethlete-io/ethdk/commit/5d1d3accbd4a7657bc50cdc0653a7ca24fe761e2) Thanks [@TomTomB](https://github.com/TomTomB)! - Add scrollable component

### Patch Changes

- [`8d31d0b`](https://github.com/ethlete-io/ethdk/commit/8d31d0b0ea523c6f79680e3a2cbf5ceba109f5d9) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix minor style issues in pip components

## 0.1.0-next.1

### Minor Changes

- [#2958](https://github.com/ethlete-io/ethdk/pull/2958) [`8ecdfc0`](https://github.com/ethlete-io/ethdk/commit/8ecdfc00d785b0b535601b5d95ca7e2cd55455b6) Thanks [@github-actions](https://github.com/apps/github-actions)! - Update default theming

## 0.1.0-next.0

### Minor Changes

- [#2933](https://github.com/ethlete-io/ethdk/pull/2933) [`bd86575`](https://github.com/ethlete-io/ethdk/commit/bd865753470ec770d5f182da33d6f8b27f18dceb) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add button components, spinner component and new icons

- [#2933](https://github.com/ethlete-io/ethdk/pull/2933) [`3f22771`](https://github.com/ethlete-io/ethdk/commit/3f22771bb3a339461ce8c70a48e573897579f3c4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add notification components

- [#2933](https://github.com/ethlete-io/ethdk/pull/2933) [`3f22771`](https://github.com/ethlete-io/ethdk/commit/3f22771bb3a339461ce8c70a48e573897579f3c4) Thanks [@github-actions](https://github.com/apps/github-actions)! - Add stream components

All notable changes to this project will be documented in this file.
