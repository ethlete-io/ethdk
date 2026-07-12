# Overlays

The overlay system is the foundation for everything floating in `@ethlete/components` — dialogs, sheets, popovers, and internally also [menus](/components/menu), [tooltips](/components/tooltip) and [toggletips](/components/toggletip). It renders a component (or template) in a detached pane, positions it (centered, anchored, or strategy-driven), and manages backdrop, focus, dismissal and animations. Under the hood it drives the [overlay runtime](/core/overlay-runtime) from `@ethlete/core` — relevant only if you're building your own floating primitive.

## Setup

Call `provideOverlay()` once at bootstrap — it registers the scroll blocker that locks body scroll while overlays are open:

```ts
import { provideOverlay } from '@ethlete/components';

export const appConfig: ApplicationConfig = {
  providers: [provideOverlay()],
};
```

## Opening an overlay

`injectOverlayManager()` returns the root `OverlayManager`. `open(component, config?)` mounts the component and returns a typed `OverlayRef`:

```ts
import { dialogOverlayStrategy, injectOverlayManager } from '@ethlete/components';

export class ExampleComponent {
  private overlayManager = injectOverlayManager();

  protected openDialog() {
    const ref = this.overlayManager.open(ExampleOverlayComponent, {
      strategies: dialogOverlayStrategy({ maxWidth: '480px' }),
    });

    ref.afterClosed().subscribe((result) => console.log(result));
  }
}
```

::: tip Prefer overlay openers
For overlays opened from more than one place — or anything with lifecycle callbacks — use the [overlay opener API](/components/overlay-openers) (`defineOverlay` + `createOverlayOpener`) instead of calling the manager directly. It removes the repeated config and handles subscription cleanup for you.
:::

Defaults worth knowing:

| Option                                   | Default                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                   | `'modal'` — set `'non-modal'` for popover-style overlays                                                                   |
| `role`                                   | `'dialog'` when modal                                                                                                      |
| `hasBackdrop`                            | Follows `mode` (modal → backdrop)                                                                                          |
| `closeOnEscape`, `closeOnOutsidePointer` | `true`; `disableClose: true` forces both off                                                                               |
| Position                                 | Anchored to `origin` when it's an element, otherwise centered                                                              |
| `origin` (with strategies)               | Falls back to the currently focused element (used as transform origin too)                                                 |
| `customAnimated`                         | `false` — set `true` to disable the built-in animations and drive your own via the [animation lifecycle](/core/animations) |

Data goes in via `bindings` (Angular's `inputBinding` / `outputBinding` / `twoWayBinding`) and `providers` — see [passing data](/components/overlay-openers#passing-data-into-the-overlay).

### The overlay ref

The `OverlayRef` is returned by `open` and injectable inside the overlay via the `OVERLAY_REF` token (or, with openers, via `definition.injectRef()`):

- `close(result?)` — close with an optional typed result
- `afterOpened()`, `beforeClosed()`, `afterClosed()` — one-shot observables
- `componentInstance()` — the content component instance
- `updatePositionStrategy(strategy)` — reposition without remounting
- `id`, `config`, `elements` (`paneElement` / `hostElement` / `backdropElement`) — identity and DOM access

The manager also exposes an `openOverlays` computed with every currently open ref.

## Live demo

<StoryEmbed id="components-overlay--default" height="480px" />

## Building overlay content

Import `OVERLAY_CONTENT_IMPORTS` into the overlay component and structure it with the content pieces — a grid layout with pinned header/footer and a scrolling body:

```html
<div etOverlayMain>
  <div etOverlayHeader>
    <h2 et-overlay-title>Example overlay</h2>
  </div>

  <div dividers="dynamic" et-overlay-body>… scrolling content …</div>

  <div etOverlayFooter>
    <button et-button etOverlayClose variant="outline">Cancel</button>
    <button et-button etOverlayClose="confirmed">Confirm</button>
  </div>
</div>
```

```ts
import { OVERLAY_CONTENT_IMPORTS } from '@ethlete/components';
```

| Piece                    | Selector                               | Purpose                                                                                                                  |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `OverlayMainDirective`   | `[etOverlayMain]`                      | Layout wrapper enabling pinned header/footer + scrolling body; often applied via `hostDirectives`                        |
| `OverlayHeaderDirective` | `[etOverlayHeader]`                    | Pinned header region                                                                                                     |
| `OverlayBodyComponent`   | `et-overlay-body`, `[et-overlay-body]` | Scrollable body; `dividers: 'static' \| 'dynamic' \| false` shows edge dividers while scrolled; `scrollToTop(behavior?)` |
| `OverlayFooterDirective` | `[etOverlayFooter]`                    | Pinned footer region                                                                                                     |
| `OverlayTitleDirective`  | `[etOverlayTitle]`                     | Wires the overlay's `aria-labelledby` to the title element                                                               |
| `OverlayCloseDirective`  | `[etOverlayClose]`                     | Click closes the nearest overlay; the bound value becomes the close result                                               |

## Strategies

A strategy controls the overlay's position, sizing, classes and animation. Pass one via `config.strategies`:

| Factory                                                  | Shape                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `dialogOverlayStrategy`                                  | Centered dialog (`width: min(512px, 80vw)` by default)            |
| `fullScreenDialogOverlayStrategy`                        | Full-screen, animates from the origin element                     |
| `bottomSheetOverlayStrategy`                             | Bottom sheet, drag-to-dismiss downwards                           |
| `topSheetOverlayStrategy`                                | Top sheet, drag-to-dismiss upwards                                |
| `leftSheetOverlayStrategy` / `rightSheetOverlayStrategy` | Side sheets, drag-to-dismiss sideways                             |
| `anchoredDialogOverlayStrategy`                          | Anchored popover next to `origin` (floating-ui), arrow by default |
| `centeredOverlayStrategy`                                | Plain centered pane with size overrides                           |

Every factory accepts a partial `OverlayBreakpointConfig` (sizes, classes, `dragToDismiss`, `hasBackdrop`, `arrow`, …).

### Responsive (transforming) strategies

`strategies` is an array of `{ breakpoint?, strategy }` entries — the controller picks the entry matching the current `min-width` and **switches live on resize without remounting** the content. Breakpoint names come from the app's [viewport config](/core/providers#breakpoint-observer) (Tailwind-style `xs`–`2xl` by default). Presets cover the common pairs:

```ts
import { transformingBottomSheetToDialogOverlayStrategy } from '@ethlete/components';

this.overlayManager.open(ExampleOverlayComponent, {
  // bottom sheet below `md`, dialog from `md` upwards
  strategies: transformingBottomSheetToDialogOverlayStrategy({ breakpoint: 'md' }),
});
```

Also available: `transformingFullScreenDialogToDialogOverlayStrategy` and `transformingFullScreenDialogToRightSheetOverlayStrategy`. Custom combinations are just arrays — each strategy provider (e.g. `injectDialogStrategy()`) exposes `.build(config)`, and app-wide defaults can be tuned via `provideDialogStrategyDefaults` and friends.

### Anchored overlays and the arrow

Anchored strategies position relative to `config.origin` using floating-ui (`placement`, `fallbackPlacements`, `offset`, `shift`, `autoHide`, …). With `arrow: true` (the `anchoredDialogOverlayStrategy` default) the pane renders an arrow pointing at the origin. The arrow takes its background and border from the [surface theme](/core/theming) so it reads as part of the panel — overridable via `--et-overlay-arrow-background` / `--et-overlay-arrow-border` — and is the same arrow used by menus, tooltips and toggletips.

## Declarative overlays

For template-driven popovers there's a headless directive set (`OVERLAY_IMPORTS`) that skips the manager entirely:

```html
<div [(open)]="filtersOpen" etOverlay placement="bottom-start">
  <button etOverlayTrigger et-button>Filters</button>

  <ng-template etOverlaySurface let-close="close">
    <div class="filters-panel">
      …
      <button (click)="close()" et-button>Done</button>
    </div>
  </ng-template>
</div>
```

- `[etOverlay]` — orchestrator; `open` is a two-way model, plus `show()` / `hide(result?)` / `toggle()`. Defaults to **non-modal** (the manager defaults to modal).
- `[etOverlayTrigger]` — click toggles, manages `aria-expanded`.
- `[etOverlayAnchor]` — optional separate positioning reference.
- `ng-template[etOverlaySurface]` — the content (required); context provides `close(result?)`.

```ts
import { OVERLAY_IMPORTS } from '@ethlete/components';
```

When an anchor/trigger exists (and mode is non-modal) the surface opens anchored; otherwise centered.

`[etOverlay]` mirrors most of the imperative config as inputs:

| Input                                        | Default       | Notes                                                |
| -------------------------------------------- | ------------- | ---------------------------------------------------- |
| `mode`                                       | `'non-modal'` | `'modal'` adds backdrop + focus trap semantics       |
| `role`                                       | —             | Overrides the mode-derived ARIA role                 |
| `disabled`                                   | `false`       | Ignores open requests while set                      |
| `disableClose`                               | `false`       | Forces `closeOnEscape` / `closeOnOutsidePointer` off |
| `closeOnEscape` / `closeOnOutsidePointer`    | `true`        |                                                      |
| `hasBackdrop`                                | —             | Follows `mode` when unset                            |
| `autoFocus` / `restoreFocus`                 | — / `true`    | Initial focus target; restore focus on close         |
| `hostClass` / `backdropClass` / `panelClass` | —             | Extra classes per overlay element                    |
| `placement`                                  | `'bottom'`    | floating-ui placement (anchored mode)                |
| `fallbackPlacements`                         | —             | Tried when `placement` doesn't fit                   |
| `offset` / `viewportPadding`                 | `8` / `8`     | Distance from anchor / viewport edges                |
| `shift`                                      | `true`        | Slide along the axis to stay in the viewport         |
| `autoResize`                                 | `false`       | Constrain size to the available space                |
| `autoHide`                                   | `false`       | Hide when the anchor leaves the viewport             |
| `autoCloseIfReferenceHidden`                 | `false`       | Close instead of just hiding                         |
| `mirrorWidth`                                | `false`       | Match the anchor's width (select-style panels)       |

## Routing inside overlays

Multi-step overlays (wizards, settings dialogs) use the overlay router — an internal router independent of Angular's, optionally mirrored into the URL:

```ts
import { provideOverlayRouter } from '@ethlete/components';

this.overlayManager.open(SettingsOverlayComponent, {
  strategies: dialogOverlayStrategy({ width: 480, height: 'min(520px, 80vh)' }),
  providers: [
    provideOverlayRouter({
      routes: [
        { path: '/', component: GeneralPageComponent },
        { path: '/members', component: MembersPageComponent },
      ],
      syncUrl: true, // deep links + browser back/forward via a query param
    }),
  ],
});
```

Inside the overlay:

- `<et-overlay-router-outlet />` renders the active route with slide/fade transitions.
- `[etOverlayRouterLink]="'/members'"` navigates (absolute or relative paths, `aria-current` when active).
- `[etOverlayBackOrClose]` goes back — or closes the overlay when there's no history.
- `ng-template[etOverlayHeaderTemplate]` in a page + `<et-overlay-route-header-template-outlet />` in the shared header lets each route supply its own header content.
- `ng-template[etOverlaySharedRouteTemplate]` + `<et-overlay-shared-route-template-outlet />` do the same for content shared across **all** routes (rendered wherever the outlet sits).
- `ng-template[etOverlayRouterOutletDisabledTemplate]` provides fallback content shown while the router outlet is disabled.
- `injectOverlayRouter()` gives programmatic access (`navigate`, `back`, `currentRoute`, …).

<StoryEmbed id="components-overlay-with-routing--default" height="520px" />

### Sidebar layouts

`provideSidebarOverlay(config?)` (requires the overlay router) adds a responsive sidebar: above `renderSidebarFrom` (default `'md'`, measured against the **pane** width) the `<et-overlay-sidebar>` renders inline next to the outlet (with each nav target as an `<et-overlay-sidebar-page>`); below it, the sidebar collapses into a navigable route of its own.

## Accessibility

- **Role**: modal overlays default to `role="dialog"` (`config.role` accepts `'dialog' | 'alertdialog'`); non-modal overlays get no role unless you set one.
- **Name/description**: set `ariaLabel`, `ariaLabelledBy` or `ariaDescribedBy` in the config — or just use `[et-overlay-title]`, which auto-wires the overlay's `aria-labelledby` to the title element when nothing else names it.
- **Focus**: `autoFocus` targets `'container' | 'first-heading' | 'first-tabbable'`, a CSS selector, or `false`; `restoreFocus` (default `true`) returns focus to the opener on close. With the overlay router, each navigation re-applies initial focus to the new page (default `'first-tabbable'`), and `[etOverlayRouterLink]` sets `aria-current="page"` on the active link.
- **Dismissal & scroll**: `closeOnEscape` and `closeOnOutsidePointer` default to `true` (`disableClose` forces both off), and body scroll is locked while any _modal_ overlay is open — non-modal overlays (tooltips, popovers) never lock the page.

## Error codes

Structural misuse (pieces outside `[etOverlay]`, missing surface, nested mains) throws [`ET12xx` errors](/components/error-codes#overlay-et12xx) — most in dev mode only.
