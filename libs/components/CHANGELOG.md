# Changelog

## 1.0.0-next.17

### Major Changes

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay: replace the `inputBindings` / `outputBindings` config objects with a
  single `bindings` array using Angular's native binding API. Bind overlay
  component inputs, outputs, and two-way models with `inputBinding`,
  `outputBinding`, and `twoWayBinding` from `@angular/core`.

### Patch Changes

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Fix icon directive typing and improve the icon generator config.
  - `IconDirective` now explicitly annotates its inputs as `InputSignal<RegisteredIconName>` and `InputSignal<RegisteredIconVariant | undefined>`. Without the annotation the d.ts bundler inlined the registry aliases to `string`, so consumer-side `declare module` augmentation of `EthleteIconNameRegistry` / `EthleteIconVariantRegistry` had no effect. `etIcon`/`variant` are now actually narrowed to the registered names.
  - The `@ethlete/components:icons` generator config takes a top-level `variants` list (replacing the singular `defaultVariant`). Bare string entries — and object entries without their own `variant`/`variants` — inherit it, so a set of icons that all share a style no longer needs the variant repeated on every entry.
  - The generator's `source: "auto"` sentinel is now honored when set in the config file (previously only the CLI default auto-detected; a config `"auto"` was treated as a package literally named "auto").

- [`11ce5e1`](https://github.com/ethlete-io/ethdk/commit/11ce5e1795249a6b975dab2eab7e8e2a9c9bc979) Thanks [@TomTomB](https://github.com/TomTomB)! - Overlay routing: a shell that wraps only the router outlet (each route carries its own `et-overlay-main` with header/body/footer) now reliably bounds the outlet to the pane. The shell content grid pins both axes (`grid-template-columns`/`grid-template-rows: minmax(0, 1fr)`), so the outlet fills a fixed-height dialog and the routed page's body scrolls with its header and footer pinned — instead of the whole overlay scrolling. The `minmax(0, ...)` column also stops a wide child (e.g. a rich-text editor) from blowing the grid past the pane width.

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
  grid is editable, instead of only after a drag has committed — so the initial
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

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: replace the built-in `✕` remove button and its `showDefaultRemoveAction` config option with `GridItemDefaultActionsComponent` (`et-grid-item-default-actions`) — a toolbar with an icon remove button that is now rendered by default. It is used automatically when the grid config leaves `actionsComponent` unset; set `actionsComponent` to your own component to replace it, or to `null` to render no actions. Its aria label is configurable via the new `removeActionAriaLabel` grid config option (defaults to `'Remove item'`, run through `transformer`).

  Also removes the now-redundant drag-handle slot: the `dragHandleComponent` config option, the `dragHandleAriaLabel` config option, and the `etGridItemDragHandle` projection slot are gone. With whole-item drag the item content is the drag surface, so a dedicated handle is no longer needed — project a decorative grip into the item content instead.

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: add `GridItemToolbarComponent` (`et-grid-item-toolbar`), a themeable container for per-item controls (edit, remove, …). Drop it into an item's action slot and project action buttons (e.g. `IconButtonComponent`) into it. It stops pointerdown so the toolbar is never a drag surface even when the whole item is draggable, and is themeable via the `--et-grid-item-toolbar-background` / `-gap` / `-padding` / `-radius` custom properties. Exported from the grid entrypoint and included in `GridImports`.

- [`b323ef6`](https://github.com/ethlete-io/ethdk/commit/b323ef66130d196e5c893e844d50ecfc85487373) Thanks [@TomTomB](https://github.com/TomTomB)! - Grid: in edit mode the whole item is now a drag surface — a pointerdown anywhere on the item content starts a drag, instead of only the drag handle slot. Interactive overlays (the actions slot, resize handles, or anything that stops propagation such as `GridItemToolbarComponent`) still win, and read-only grids keep their content inert. Also fixes the `et-grid--readonly` class never being applied to the grid host, so the intended read-only styles (non-interactive drag handle, hidden resize handles) now take effect, and adds a grab/grabbing cursor on the content while editing.

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
