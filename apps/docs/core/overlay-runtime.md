# Overlay runtime

The low-level engine that mounts components into a floating layer - DOM scaffolding, backdrop, positioning, focus trapping and lifecycle animation. The [components overlay system](/components/overlays) (dialogs, sheets, menus, tooltips) is built on top of it; **reach for that first**. Use the runtime directly only when building your own floating primitive.

```ts
import { anchoredOverlayPosition, injectOverlayRuntime } from '@ethlete/core';

const runtime = injectOverlayRuntime();

const ref = runtime.mount({
  id: 'my-popover',
  component: MyPopoverComponent,
  positionStrategy: anchoredOverlayPosition({ referenceElement: trigger }),
  modal: false,
});

ref.afterClosed().subscribe(({ result, source }) => {
  /* … */
});
```

`injectOverlayRuntime()` is root-provided. It lazily creates an `et-overlay-runtime-root` container on `<body>`, shared by every overlay on the same [stacking level](#stacking-levels); each overlay gets a host element, an optional backdrop and a pane that your component renders into. `runtime.openEntries` is a signal of all currently open overlays.

## Mount config

| Option                                                     | Default              | Description                                                                       |
| ---------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `id`                                                       | - (required)         | Identifies the overlay (`data-overlay-id`).                                       |
| `component`                                                | - (required)         | The component to mount.                                                           |
| `positionStrategy`                                         | `{ kind: 'center' }` | See [position strategies](#position-strategies).                                  |
| `modal`                                                    | `true`               | Modal overlays get a focus trap and `aria-modal`.                                 |
| `hasBackdrop`                                              | `true`               | Render a backdrop element.                                                        |
| `autoFocus`                                                | `'first-tabbable'`   | `'container' \| 'first-heading' \| 'first-tabbable'`, a CSS selector, or `false`. |
| `restoreFocus`                                             | `true`               | Restore focus to the previously focused element on close.                         |
| `closeOnEscape`                                            | `true`               | Escape closes the top-most overlay.                                               |
| `closeOnOutsidePointer`                                    | `!modal`             | Pointer down outside the pane closes it.                                          |
| `role`                                                     | `null`               | `'dialog' \| 'alertdialog'`.                                                      |
| `ariaLabel` / `ariaLabelledBy` / `ariaDescribedBy`         | -                    | Accessibility wiring.                                                             |
| `hostClass` / `backdropClass` / `paneClass`                | -                    | Extra classes on the scaffold elements.                                           |
| `providers` / `injector` / `viewContainerRef` / `bindings` | -                    | DI and input bindings for the mounted component.                                  |
| `animationDelegate`                                        | -                    | Custom `enter`/`leave` drivers (must settle the lifecycle).                       |
| `zIndex`                                                   | `2147483003`         | The stacking level to mount at - see [stacking levels](#stacking-levels).         |

If the mounted component exposes an `animatedLifecycle` signal (an [`AnimatedLifecycleDirective`](/core/animations)), the runtime drives its enter/leave transitions and waits for `'left'` before tearing down; otherwise open/close is synchronous.

## Stacking levels

Overlays mount at `DEFAULT_OVERLAY_LAYER` (`2147483003`, near int32 max so an overlay outranks an application's own stacking). Overlays sharing a level share one root container and stack in open order, which is all a normal app ever needs.

A level above that exists for the one case order cannot solve: something that must paint over every overlay - a devtools panel, an always-on-top widget - and still be able to open a menu, a tooltip or a dialog of its own. Declare the level once on that element:

```html
<!-- the panel itself sits at 2147483010 in CSS; its overlays go one level above it -->
<div class="my-panel" data-et-overlay-layer="2147483020">…</div>
```

Every overlay opened from inside it - including nested ones, because the runtime stamps the same attribute on each root it creates - mounts into a root at that level instead of the default one. `resolveOverlayLayer(element)` reads the level an element resolves to, and the [components overlay system](/components/overlays) applies it automatically from the overlay's `origin`. Set `zIndex` on a single `mount()` (or `open()`) call only for a one-off that no element declares.

This is how the [query devtools](/query-devtools/) stay visible while an application's own modal is open.

### A press on a level above never closes what is below

The declared level also decides which pointer presses count as "outside". Every outside-pointer close in the SDK - the runtime's own `closeOnOutsidePointer`, the components' menus, tooltips and anchored panels, `[etClickOutside]` - first asks `isOnHigherOverlayLayer(target, ownLayer)`. A press that lands on a surface painting above the overlay is aimed at that surface, not at the content the overlay covers, so it leaves the overlay open.

```ts
import { isOnHigherOverlayLayer, resolveOverlayLayer } from '@ethlete/core';

// inside your own outside-pointer handler
if (isOnHigherOverlayLayer(event.target, resolveOverlayLayer(myTriggerElement))) return;
```

A press on the same level still closes as before, so an overlay opened from inside such a surface (a panel's own menu) closes when the user presses elsewhere in that panel. This is why working in the query devtools leaves an open select, menu or sheet in the inspected app alone.

## Reserved viewport space

A surface that paints over the page - a docked devtools panel, an always-on-top widget - covers whatever an overlay is centered in. Page content can be scrolled out from under it; a dialog, a menu or a sheet cannot. Reserve the edge it sits on and every overlay below it keeps out:

```ts
import { reserveOverlayViewportSpace } from '@ethlete/core';

// the panel is 360px tall, docked to the bottom, and paints at z-index 2147483010
const release = reserveOverlayViewportSpace({ bottom: 360, layer: 2147483010 });

// give the space back when the panel closes
release();
```

What each position strategy does with it:

| Strategy   | Effect                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `center`   | The host box shrinks to what is left of the viewport, so the pane is centered in that.                                                                              |
| `global`   | Same, so an `end`-aligned sheet sits on the reserved edge instead of under it.                                                                                      |
| `anchored` | The reserved edge is added to `viewportPadding`, so the pane flips, shifts and (with `autoResize`) shrinks against it exactly as it does against the viewport edge. |

The reservation is scoped by `layer` (default one above `DEFAULT_OVERLAY_LAYER`): only overlays **below** that level keep out of it. The reserving surface's own overlays declare a level above it - see [Stacking levels](#stacking-levels) - so a menu opened inside the panel may still use the panel's space. An open overlay is laid out again whenever a reservation is made, resized or released, so dragging a panel's edge moves the overlay with it.

`overlayViewportInsets(layer?)` reads the current reservation as `{ top, right, bottom, left }`, and `overlayViewportInsetsFor(element)` does the same for the level an element resolves to. Reservations stack by taking the **largest** value per edge, not the sum.

### Page chrome reads the CSS custom properties

The runtime can only move what it positions itself. Anything else that floats over the page - a sticky action bar, an app's own floating button - reads the same reservation from four custom properties published on the document root while it is held:

```css
.my-sticky-action-bar {
  position: sticky;
  inset-block-end: calc(1.6rem + var(--et-viewport-inset-bottom, 0px));
}
```

`--et-viewport-inset-top`, `--et-viewport-inset-right`, `--et-viewport-inset-bottom` and `--et-viewport-inset-left` are set while anything is reserved and removed again when nothing is - so always give the `var()` a `0px` fallback. Unlike the overlay insets they ignore `layer`: page content paints below every reserving surface. The SDK's own floating chrome - [notifications](/components/notification) and the [floating action](/components/floating-action) - already composes them.

This is how the [query devtools](/query-devtools/#reserve-page-space) keep an application's dialogs, menus and toasts out of the docked panel.

## Position strategies

- `{ kind: 'center' }` - centered with a 16px viewport padding (the default).
- `{ kind: 'global', horizontal?, vertical?, padding? }` - edge/corner placement; alignments are `'start' | 'center' | 'end' | 'stretch'` (default `'center'`), padding default `0`.
- `anchoredOverlayPosition({ referenceElement, … })` - Floating-UI anchored positioning with `placement` (default `'bottom'`), `fallbackPlacements`, `offset` (default `8`), `viewportPadding` (default `8`), `arrowPadding` (default `12`, i.e. how close the arrow's base may get to the pane's corners - raise it for a pane whose corner radius is larger than that), `shift` (default on), `autoResize`, `minAvailableSpace`, `autoHide`, `autoCloseIfReferenceHidden` and `mirrorWidth`.

  `minAvailableSpace` (px) is the alternative to `fallbackPlacements` for a pane that scrolls: the pane keeps its placement's own side while that side offers at least this much space and `autoResize` shrinks it into what is there, moves to the opposite side only below the minimum, and keeps the roomier side when neither reaches it. It measures the space around the reference rather than the pane, so a pane whose content changes while it is open can never flip sides mid-animation - which `flip` does, because it compares the pane's `size`-derived height against the space it has. Setting it replaces `flip` and forces `shift`'s cross axis off. See [the select's panel placement](/components/select#panel-placement).

  Anchored positioning is the only part of the runtime that needs `@floating-ui/dom`, and it is reachable only through `anchoredOverlayPosition()` - an app that never anchors an overlay does not bundle it. A plain `{ kind: 'anchored', … }` literal still type-checks, but the pane falls back to centered positioning (with a dev-mode error) unless something in the app called `anchoredOverlayPosition()`.

  `autoResize`, `autoHide`, `autoCloseIfReferenceHidden` and arrows additionally need `enableAnchoredOverlayPositionExtras()`, which installs the floating-ui `size`/`hide`/`arrow` middleware. Call it once next to where the strategy is built.

  A reference that is **removed from the document** while the overlay is open is handled without either of
  those: the pane keeps its last position instead of being moved to the rect a detached element measures
  as (zeros, i.e. the viewport's top-left corner), so an overlay whose trigger is destroyed - a menu item
  that removes the button it was opened from - animates out where it was. With
  `autoCloseIfReferenceHidden` it closes at once, before any transform is applied.

The active strategy can be swapped on a live overlay via `ref.updatePositionStrategy(strategy)` - this is how responsive overlays morph between dialog and bottom sheet.

## The overlay ref

`mount()` returns an `OverlayRuntimeRef`:

| Member                             | Description                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `close(result?, source?)`          | Close with an optional result (`source` defaults to `'api'`). Runs registered close guards first. |
| `forceClose(result?, source?)`     | Close bypassing every close guard - used by a guard's owner to commit a close it vetoed.          |
| `registerCloseGuard(guard)`        | Register a synchronous veto `(event) => boolean` for pending closes; returns an unregister fn.    |
| `state`                            | `Signal<'mounting' \| 'mounted' \| 'closing' \| 'closed'>`                                        |
| `componentInstance`                | `Signal<TComponent \| null>`                                                                      |
| `beforeOpened()` / `afterOpened()` | Open lifecycle observables.                                                                       |
| `beforeClosed()` / `afterClosed()` | Emit `{ result, source }` - `source` is `'api' \| 'escape' \| 'outside-pointer' \| 'drag'`.       |
| `elements`                         | The scaffold DOM (`rootElement`, `hostElement`, `backdropElement`, `paneElement`).                |

Escape and outside-pointer closes only apply to the top-most overlay and are ignored until the enter transition has started - a click that opens an overlay can't immediately close it.

**Close guards** are the veto seam behind unsaved-changes protection. Each registered guard runs synchronously before a close commits; if any returns `false`, the close is cancelled. A guard that needs an async decision (e.g. a confirm dialog) returns `false` to veto, then re-issues the close via `forceClose` once resolved. `reference-detached` closes (the anchor is gone) always bypass guards. `@ethlete/components` builds `createOverlayUnsavedChangesGuard` on this seam - see [Utilities › Unsaved changes](/core/utilities#unsaved-changes).

For debugging, the runtime shares the [`et-overlay-debug` localStorage flag](/core/animations#debugging) with the animation system.

## Standalone focus & positioning utilities

The building blocks behind the runtime are exported for custom floating UI:

- **Focus** - `getFocusableElements(container, document)` / `isFocusable(el)` (based on the exported `FOCUSABLE_SELECTOR`), `focusElement(el)`, `applyInitialFocus(…)` and `setupFocusTrap(…)` (returns a cleanup function).
- **Positioning** - `setupPositioning(…)` plus the lower-level `applyCenteredPosition`, `applyGlobalPosition` and `createAnchoredPositionCleanup` used by the [position strategies](#position-strategies).
- **Misc** - `getHeadingElement(container)` (finds the first heading for `aria-labelledby`) and the `isHTMLElement` guard.
