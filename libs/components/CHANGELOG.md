# Changelog

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
  - `OverlayHandlerLinkDirective` (`etOverlayHandlerLink` + `etOverlayHandlerQueryParamName`) is replaced by `QueryParamOverlayLinkDirective`: `<a [etQueryParamOverlayLink]="definition" etQueryParamOverlayLinkValue="42">` — the link takes the definition object, so the query param key is no longer duplicated as a string.

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

  Menus enable this by default: a nested submenu near the viewport edge first flips to the other side and, when neither side fits, slides over its parent menu — matching native OS menu behavior — instead of being cut off by the viewport.

  The `size` middleware (`autoResize`) now runs after `shift` instead of before it, so `--et-overlay-max-width` / `--et-overlay-max-height` are measured from the pane's shifted position. Previously a cross-axis-shifted pane had its max size capped to the unshifted leftover space, squeezing e.g. a submenu to a sliver instead of letting it keep its width while overlapping its parent.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`789d765`](https://github.com/ethlete-io/ethdk/commit/789d765e1342f92d1269f1d8a1dbb64e28415708) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: new `et-dropzone` file-upload control with a built-in `@ethlete/query` upload workflow. Import `DROPZONE_IMPORTS`.
  - Files are picked via click or drag & drop and uploaded through a consumer-provided query, one query per file. Configure with `createDropzoneUpload({ queryCreator, selectValue, createArgs?, resolveExisting? })` — `selectValue` maps the upload response to the form control value (e.g. `(media) => media.uuid`).
  - Signal-forms native (`[formField]`): the control value holds the values of successful uploads (and existing entries) in entry order — `TValue | null` in single mode, `TValue[]` with `multiple`. In-flight and failed uploads never enter the value; block submits via the headless `anyUploading` signal.
  - Built-in UI: per-file progress bars (requires `reportProgress: true` on the query creator and the XHR `HttpClient` backend; degrades to indeterminate otherwise), image previews via object URLs, remove/replace/retry via regular icon buttons, and enter/leave animations (FLIP shift plus scale-out on delete, disabled under `prefers-reduced-motion`). In single mode a successful upload replaces the drop area with a same-size preview (no layout shift).
  - Validation lives in the form schema: `required()`/`minLength()`/`maxLength()` cover emptiness and file count, and the new `dropzoneFiles()` schema rule declares file constraints (`accept`, `maxFileSize`, `minFileSize`). Violating files never upload — each violation becomes a regular validation error on the field (customizable via the rule's `message` function) and is emitted via `filesRejected`. Upload failures render as validation-style messages below the field (`uploadErrorMessage` input).
  - Edit forms: values already present in the control render as entries via the `resolveExisting` display resolver.
  - Full behavior is available headlessly via the `etDropzone` directive (`entries()`, `lastRejections()`, `selectFiles()`, `removeEntry()`, `retryEntry()`, `clear()`, `isDragOver`, …). Error codes `ET2400`–`ET2499`.

  Icons: new built-in `UPLOAD_ICON` (`et-upload`), `FILE_ICON` (`et-file`) and `ROTATE_RIGHT_ICON` (`et-rotate-right`) definitions. The dev-mode icon color validation now allows `fill="none"` / `stroke="none"` (only actual hardcoded colors are rejected).

  **`@ethlete/components` now has a peer dependency on `@ethlete/query`** (`^6.0.0-beta.8`).

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Grid & Tabs: the previously allocated error codes are now actually enforced, and a nav-tabs composition bug is fixed.
  - Tabs (dev mode): `ET2000` when a tab trigger has no enclosing tab bar, `ET2001` when `<et-tab>` / `etTabPanel` sit outside a tab group (an orphan `<et-tab>` used to disappear silently), `ET2002` when a headless tab group has triggers but no panels, `ET2003` when nav-tab pieces are used without `et-nav-tabs`.
  - Grid (dev mode): `ET1900` for items outside a grid, `ET1901` for drag/resize handles outside a grid item, `ET1902` for duplicate item ids, `ET1903` when `restoreState()` receives unknown breakpoint names, and the new `GRID_ERROR_CODES.UNKNOWN_ITEM_TYPE` (`ET1904`) when an item's `type` has no registration — previously such items were silently dropped.
  - Fixed: `<et-nav-tabs-outlet>` placed as a sibling of `<et-nav-tabs>` (the documented composition) crashed with a DI error. It now resolves the tab bar that labels it automatically when exactly one `et-nav-tabs` exists on the page, and still prefers an ancestor tab bar when nested.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: trigger-anchored root menus now render a floating arrow pointing at their trigger, matching the tooltip and toggletip look. The new `arrow` input on `[etMenu]` (default `true`) controls it — set `[arrow]="false"` to opt out — and `arrowPadding` (default `8`) tunes how close the arrow may get to the panel corners. Submenus and context menus (point-anchored) never render an arrow.
  - With the arrow enabled, the `'auto'` offset resolves to `10` so the arrow has room between the panel and its trigger; disabling the arrow restores the previous tight spacing. Submenu and context menu spacing is unchanged.
  - The arrow picks up the menu surface theme (`--et-surface-background-solid` / `--et-surface-border-solid`) and can be overridden via `--et-overlay-arrow-background` and `--et-overlay-arrow-border`.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`2f18e43`](https://github.com/ethlete-io/ethdk/commit/2f18e4344759dbbcd17ba0dbeca138f1f7043cdf) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the menu now fully respects the surface and color theming systems instead of shipping a hardcoded dark palette.
  - Borders, separators, muted text (group labels, shortcuts, the search placeholder/spinner) and the search input fill now derive from the surface tokens (`--et-surface-border-solid`, `--et-surface-color-muted-solid`, `--et-surface-interaction-solid`).
  - The active menu item highlight is now a `color-mix` tint of `--et-surface-interaction-solid` instead of a fixed white overlay.
  - The menu panel resolves its surface via `AutoSurfaceDirective`, automatically picking the next elevation relative to the trigger's surface context.
  - Destructive menu items and the search error message now use the app's registered `error` color theme (via `injectErrorTheme()`), so `--et-theme-color-primary-*` resolves to the error palette inside them. The `--et-menu-item-destructive-color` token has been removed — theme the error color theme instead. Like `et-form-field`, `et-menu` now requires color themes (including one with `type: 'error'`) to be registered.
  - Selection item check/radio marks and the search input focus border now use `--et-theme-color-primary-solid` from the surrounding color theme context.
  - The active-item highlight now only shows for an actual hover or `:focus-visible` (keyboard) interaction — opening a menu with the mouse no longer highlights the first item, while keyboard-opened menus still do. A trigger item whose submenu is open stays highlighted via `[data-menu-open]`.
  - The menu animates its block size (160ms) when its content changes while open — e.g. search filtering items away or the search error line appearing — instead of snapping to the new size. Respects `prefers-reduced-motion`.
  - Menu items now have a pressed (`:active`) state — a stronger tint of the surface interaction color (20% vs the 12% highlight) — and transition `background`, `color` and `opacity` (120ms) between their rest, highlighted, pressed and disabled states. The search input transitions its `border-color` and `background`, matching the button's interaction feel.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`8d5c7dc`](https://github.com/ethlete-io/ethdk/commit/8d5c7dce47c0b04592ebe366354871f177d55f0a) Thanks [@github-actions](https://github.com/apps/github-actions)! - Forms: visual refresh and new options for the selection controls (checkbox group, radio group, segmented button group, switch, choice field).
  - Checkbox options and radios: option labels now render in the regular text color at a fixed size, boxes/circles gained hover tint fills, press feedback and a draw-in checkmark animation; the group label is styled like a form-field label (new `--et-<group>-group-label-font-size` tokens).
  - Selection-list groups (`et-checkbox-group`, `et-radio-group`, `et-segmented-button-group`) now support a projected `<et-label>` as group label — it shows the required marker (`*`) and wires `aria-labelledby` automatically. The plain `.et-<group>-label` span still works for label text without the marker.
  - Segmented button group: redesigned as a tonal track with a filled active pill that animates between options (flip animation). `--et-segmented-button-border-width` was removed; new tokens `--et-segmented-button-border-radius`, `--et-segmented-button-group-track-padding`, `--et-segmented-button-group-track-radius` and `--et-segmented-button-group-label-font-size`.
  - Switch: reworked visuals — the off state uses a neutral tinted track with a smaller muted thumb that grows and slides on toggle, plus a press-stretch effect. Default dimensions changed to a 40×22px track with a 16px thumb.
  - New `size` input (`'sm' | 'md' | 'lg'`, default `'md'`) on `et-checkbox-group`, `et-radio-group`, `et-segmented-button-group` and `et-choice-field`, scaling controls, labels and gaps in line with `et-form-field` sizes.
  - Group error states now tint the unchecked control borders with the error color (previously only the error message was colored).
  - The control CSS tokens (`--et-checkbox-*`, `--et-checkbox-option-*`, `--et-radio-*`, `--et-segmented-button-*`, `--et-switch-*`) are now registered as inheriting custom properties, so overriding them on the component or a wrapper actually reaches the inner elements that consume them.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`6e9693a`](https://github.com/ethlete-io/ethdk/commit/6e9693a9352d19775f46ab5424cbdea455a14ee5) Thanks [@github-actions](https://github.com/apps/github-actions)! - Button: new split button. `<et-split-button>` groups an action segment (`etSplitButtonAction`) and a trigger segment (`etSplitButtonTrigger`) — both regular surface/icon buttons — into one `role="group"` control with joined corners and a divider between the segments.
  - The segments keep the full button API (variant, size, color, disabled, loading); the trigger typically also carries `etMenuTrigger` to open a menu with related actions.
  - The divider color is themeable via `--et-split-button-divider-color` (defaults to `currentColor` at 32%).
  - The headless `SplitButtonDirective` (`[etSplitButton]`) plus the segment directives are exported for custom-styled split buttons.
  - Missing or misplaced segments throw dev-mode errors in the new `ET23xx` range.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: theming overhaul and cleanups.
  - The PiP chrome now provides a surface theme scope (`type: 'dark'`, elevation 1) — it is mounted into `document.body` and previously had no theme context at all.
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
  - The overlay arrow is now clipped at the panel edge (it only keeps the outer tip plus the border seam), so the menu no longer adds extra clearance padding on the arrow side — padding is identical regardless of placement.
  - `arrowPadding` on `[etMenu]` now defaults to `14` (was `8`) so the arrow can no longer slide into the panel's rounded corners.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`90eeba1`](https://github.com/ethlete-io/ethdk/commit/90eeba1e6dbac11cfaef7cd4c2f0a5fa6234d642) Thanks [@github-actions](https://github.com/apps/github-actions)! - Menu: the anchor arrow no longer overlaps the panel's edge content. The rotated
  arrow dips into the panel edge nearest the trigger, which previously cut into the
  search field (panel below the trigger) or the first/last menu items (panel above
  the trigger). The adjacent content now keeps clear of the arrow.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Overlay: the anchored overlay arrow (tooltip, toggletip, anchored dialog) no longer flashes for a frame before the enter animation starts. The arrow now stays hidden while the overlay is still waiting to animate in, instead of briefly appearing, disappearing, and fading in again.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`300afe3`](https://github.com/ethlete-io/ethdk/commit/300afe3f9115f2ff18ca097975a8101690613d24) Thanks [@github-actions](https://github.com/apps/github-actions)! - Stream: accessibility fixes for the built-in overlays and self-created player iframes.
  - The iframes created by the Kick, SOOP, Dailymotion and TikTok players now carry a descriptive `title` (`"<Platform> player"`). YouTube, Vimeo, Twitch and Facebook iframes are created by the platform SDKs and cannot be titled from the library.
  - The loading overlay is now a `role="status"` region labelled "Loading", the error overlay announces itself via `role="alert"`, and the consent gate is a `role="group"` labelled by its heading.

- [#3016](https://github.com/ethlete-io/ethdk/pull/3016) [`1d324c2`](https://github.com/ethlete-io/ethdk/commit/1d324c2cbdd749cd8b01d52548a5a457a7e462df) Thanks [@github-actions](https://github.com/apps/github-actions)! - Text button: the underline is no longer shown in the resting state — it now animates in on hover, focus and press, and sits tight under the label (link-style) instead of hanging below the button's line box. Resting text buttons now align optically with neighboring buttons of the same size.

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
