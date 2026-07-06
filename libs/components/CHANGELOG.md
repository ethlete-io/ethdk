# Changelog

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
