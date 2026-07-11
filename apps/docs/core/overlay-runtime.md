# Overlay runtime

The low-level engine that mounts components into a floating layer — DOM scaffolding, backdrop, positioning, focus trapping and lifecycle animation. The [components overlay system](/components/overlays) (dialogs, sheets, menus, tooltips) is built on top of it; **reach for that first**. Use the runtime directly only when building your own floating primitive.

```ts
import { injectOverlayRuntime } from '@ethlete/core';

const runtime = injectOverlayRuntime();

const ref = runtime.mount({
  id: 'my-popover',
  component: MyPopoverComponent,
  positionStrategy: { kind: 'anchored', referenceElement: trigger },
  modal: false,
});

ref.afterClosed().subscribe(({ result, source }) => {
  /* … */
});
```

`injectOverlayRuntime()` is root-provided. It lazily creates a shared `et-overlay-runtime-root` container on `<body>`; each overlay gets a host element, an optional backdrop and a pane that your component renders into. `runtime.openEntries` is a signal of all currently open overlays.

## Mount config

| Option                                                     | Default              | Description                                                                       |
| ---------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------- |
| `id`                                                       | — (required)         | Identifies the overlay (`data-overlay-id`).                                       |
| `component`                                                | — (required)         | The component to mount.                                                           |
| `positionStrategy`                                         | `{ kind: 'center' }` | See [position strategies](#position-strategies).                                  |
| `modal`                                                    | `true`               | Modal overlays get a focus trap and `aria-modal`.                                 |
| `hasBackdrop`                                              | `true`               | Render a backdrop element.                                                        |
| `autoFocus`                                                | `'first-tabbable'`   | `'container' \| 'first-heading' \| 'first-tabbable'`, a CSS selector, or `false`. |
| `restoreFocus`                                             | `true`               | Restore focus to the previously focused element on close.                         |
| `closeOnEscape`                                            | `true`               | Escape closes the top-most overlay.                                               |
| `closeOnOutsidePointer`                                    | `!modal`             | Pointer down outside the pane closes it.                                          |
| `role`                                                     | `null`               | `'dialog' \| 'alertdialog'`.                                                      |
| `ariaLabel` / `ariaLabelledBy` / `ariaDescribedBy`         | —                    | Accessibility wiring.                                                             |
| `hostClass` / `backdropClass` / `paneClass`                | —                    | Extra classes on the scaffold elements.                                           |
| `providers` / `injector` / `viewContainerRef` / `bindings` | —                    | DI and input bindings for the mounted component.                                  |
| `animationDelegate`                                        | —                    | Custom `enter`/`leave` drivers (must settle the lifecycle).                       |

If the mounted component exposes an `animatedLifecycle` signal (an [`AnimatedLifecycleDirective`](/core/animations)), the runtime drives its enter/leave transitions and waits for `'left'` before tearing down; otherwise open/close is synchronous.

## Position strategies

- `{ kind: 'center' }` — centered with a 16px viewport padding (the default).
- `{ kind: 'global', horizontal?, vertical?, padding? }` — edge/corner placement; alignments are `'start' | 'center' | 'end' | 'stretch'` (default `'center'`), padding default `0`.
- `{ kind: 'anchored', referenceElement, … }` — Floating-UI anchored positioning with `placement` (default `'bottom'`), `fallbackPlacements`, `offset` (default `8`), `viewportPadding` (default `8`), `arrowPadding` (default `4`), `shift` (default on), `autoResize`, `autoHide`, `autoCloseIfReferenceHidden` and `mirrorWidth`.

The active strategy can be swapped on a live overlay via `ref.updatePositionStrategy(strategy)` — this is how responsive overlays morph between dialog and bottom sheet.

## The overlay ref

`mount()` returns an `OverlayRuntimeRef`:

| Member                             | Description                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `close(result?, source?)`          | Close with an optional result (`source` defaults to `'api'`).                               |
| `state`                            | `Signal<'mounting' \| 'mounted' \| 'closing' \| 'closed'>`                                  |
| `componentInstance`                | `Signal<TComponent \| null>`                                                                |
| `beforeOpened()` / `afterOpened()` | Open lifecycle observables.                                                                 |
| `beforeClosed()` / `afterClosed()` | Emit `{ result, source }` — `source` is `'api' \| 'escape' \| 'outside-pointer' \| 'drag'`. |
| `elements`                         | The scaffold DOM (`rootElement`, `hostElement`, `backdropElement`, `paneElement`).          |

Escape and outside-pointer closes only apply to the top-most overlay and are ignored until the enter transition has started — a click that opens an overlay can't immediately close it.

For debugging, the runtime shares the [`et-overlay-debug` localStorage flag](/core/animations#debugging) with the animation system.
