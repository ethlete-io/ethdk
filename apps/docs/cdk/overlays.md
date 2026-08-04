# Overlays

The overlay system renders a component (or template) in a detached pane and manages backdrop, focus, dismissal and animation around it. One runtime covers dialogs, bottom/side sheets, full-screen pages and anchored popovers - which of those you get is decided by a **strategy**, and strategies can swap at breakpoints, so the same overlay can be a bottom sheet on mobile and a centered dialog on desktop.

::: warning Superseded by @ethlete/components
New code should use the [components overlays](/components/overlays) (`OVERLAY_IMPORTS`; the content shell
is `OVERLAY_CONTENT_IMPORTS`, and the routing and sidebar pieces are imported individually rather than via
`OverlayWithRoutingImports` / `OverlayWithSidebarImports`). The strategies, `OverlayConfig`,
`injectOverlayManager` and the content directives all carry over by name. The big change is the opener
layer: the factory-returning-a-factory is gone - `createOverlayHandler` becomes
[`defineOverlay`](/components/overlay-openers) + `createOverlayOpener`, and
`createOverlayHandlerWithQueryParamLifecycle` becomes `defineQueryParamOverlay`. The services become
inject functions (`OverlayRouterService` → `injectOverlayRouter()`, `SidebarOverlayService` →
`injectSidebarOverlay()`), `createOverlayDismissChecker` becomes `createOverlayUnsavedChangesGuard`, and
`AnimatedOverlayDirective` becomes `createOverlayStrategyController`. This page documents the CDK version,
which still receives bug fixes.
:::

## Setup

Call `provideOverlay()` once at bootstrap - it registers the CDK `Dialog` and the scroll blocker that locks body scroll while an overlay is open:

```ts
import { provideOverlay } from '@ethlete/cdk';

export const appConfig: ApplicationConfig = {
  providers: [provideOverlay()],
};
```

## Opening an overlay

Define the overlay once at module scope with `createOverlayHandler`, then call the returned factory inside a component to get an opener:

```ts
// product-overlay.ts
export const productOverlayHandler = createOverlayHandler<ProductOverlayComponent, ProductData, ProductResult>({
  component: ProductOverlayComponent,
  strategies: dialogOverlayStrategy({ maxWidth: '440px' }),
});
```

```ts
// the component that opens it
export class ProductListComponent {
  private productOverlay = productOverlayHandler({
    afterClosed: (result) => console.log('closed with', result),
  });

  protected showProduct(id: string) {
    this.productOverlay.open({ data: { id } });
  }
}
```

<StoryEmbed id="cdk-overlay-overlay-handlers--handler" height="420px" />

The handler is two-staged on purpose: the outer call binds the component and its base config once (no injection context needed), the inner call runs in a component's injection context and wires the lifecycle callbacks (`afterOpened`, `beforeClosed`, `afterClosed`) with automatic unsubscription.

Inside the overlay component, read the data and the ref off the same handler - both are typed:

```ts
export class ProductOverlayComponent {
  private handler = productOverlayHandler();

  protected data = this.handler.injectOverlayData();
  protected ref = this.handler.injectOverlayRef();

  protected confirm() {
    this.ref.close('confirmed');
  }
}
```

For a one-off overlay you can skip the handler and call `injectOverlayManager().open(component, config)` directly, but you then own the subscriptions and the typing.

### Query-param overlays

`createOverlayHandlerWithQueryParamLifecycle` ties an overlay to a query parameter: the overlay opens whenever the param is present and closes when it disappears, so it survives a reload and is shareable as a URL.

```ts
export const createProductOverlay = createOverlayHandlerWithQueryParamLifecycle<ProductOverlayComponent>({
  component: ProductOverlayComponent,
  strategies: dialogOverlayStrategy(),
  queryParamKey: 'product',
});
```

<StoryEmbed id="cdk-overlay-overlay-handlers--query-param-lifecycle" height="420px" />

If the overlay component declares an input or model named `overlayQueryParam`, the current value is written into it - and when it is a `model`, writing back to it updates the URL. To carry more than one value, pack them into a single param string and split it inside the component. The inner factory may only be called once per injection context.

`[etOverlayHandlerLink]` opens one straight from a template - it is a `routerLink` that only merges the param in, so the overlay gets a real, right-clickable link:

```html
<a [etOverlayHandlerLink]="product.id" etOverlayHandlerQueryParamName="product">{{ product.name }}</a>
```

## Config

| Option                                             | Default            | Purpose                                                                                         |
| -------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `strategies`                                       | required           | A function returning the breakpoint→strategy list - see below.                                  |
| `data`                                             | `null`             | Injected into the overlay as `OVERLAY_DATA`.                                                    |
| `role`                                             | `'dialog'`         | Or `'alertdialog'`.                                                                             |
| `hasBackdrop`                                      | `true`             |                                                                                                 |
| `disableClose`                                     | `false`            | Blocks <kbd>Escape</kbd> and backdrop clicks.                                                   |
| `autoFocus`                                        | `'first-tabbable'` | Or `'dialog'`, `'first-heading'`, or a CSS selector.                                            |
| `restoreFocus`                                     | `true`             | Return focus to the previously focused element on close.                                        |
| `delayFocusTrap`                                   | `true`             | Wait for the enter animation before trapping focus.                                             |
| `closeOnNavigation`                                | `true`             | Forced to `false` when the overlay contains an overlay router.                                  |
| `ariaModal`                                        | `true`             |                                                                                                 |
| `ariaLabel` / `ariaLabelledBy` / `ariaDescribedBy` | `null`             |                                                                                                 |
| `customAnimated`                                   | `false`            | Suppress the built-in enter/leave animation.                                                    |
| `origin`                                           | -                  | The element or event that opened the overlay - used by anchored and full-screen strategies.     |
| `id`                                               | generated          |                                                                                                 |
| `providers`                                        | -                  | Extra providers for the overlay. Avoid `@Injectable()` services here; they are never destroyed. |

## Strategies

A strategy decides the size, position, classes and animation of the overlay. Each one has a `…OverlayStrategy()` shorthand for the common single-breakpoint case:

| Strategy                                                     | Shape                                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `dialogOverlayStrategy()`                                    | Centered box, `maxWidth: 80vw`, `maxHeight: 80vh`.                                                                |
| `bottomSheetOverlayStrategy()`                               | Full-width sheet at the bottom, `maxWidth: 640px`, drag-to-dismiss downwards.                                     |
| `topSheetOverlayStrategy()`                                  | Sheet from the top.                                                                                               |
| `leftSheetOverlayStrategy()` / `rightSheetOverlayStrategy()` | Full-height side sheet with drag-to-dismiss sideways.                                                             |
| `fullScreenDialogOverlayStrategy()`                          | Covers the viewport, with an origin-aware expand animation.                                                       |
| `anchoredDialogOverlayStrategy()`                            | Positioned against the `origin` element, flipping between four corners; falls back to centered without an origin. |

Each takes an `OverlayBreakpointConfig` to override `width` / `height` / `min*` / `max*`, the `positionStrategy`, `position`, `dragToDismiss`, and the `containerClass` / `paneClass` / `backdropClass` / `bodyClass` / `documentClass` hooks.

Defaults can also be set app-wide per strategy - `provideDialogStrategyDefaults({ maxWidth: '600px' })` and friends.

### Responsive strategies

`strategies` returns a list of `{ breakpoint, strategy }` entries, each applying from its breakpoint upwards (min-width). The ready-made presets cover the common transitions:

```ts
strategies: transformingBottomSheetToDialogOverlayStrategy({ breakpoint: 'md' });
```

| Preset                                                    | Below the breakpoint | From the breakpoint |
| --------------------------------------------------------- | -------------------- | ------------------- |
| `transformingBottomSheetToDialogOverlayStrategy`          | Bottom sheet         | Dialog              |
| `transformingFullScreenDialogToDialogOverlayStrategy`     | Full-screen          | Dialog              |
| `transformingFullScreenDialogToRightSheetOverlayStrategy` | Full-screen          | Right sheet         |

All default to `'md'`, and each half takes its own config override. Crossing the breakpoint while the overlay is open **transforms it in place** - it is not closed and reopened, and the strategies get `onSwitchedTo` / `onSwitchedAwayFrom` callbacks to hand over their state.

<StoryEmbed id="cdk-overlay-overlay-strategies-responsive--default" height="420px" />

Writing your own strategy means providing an `OverlayStrategy`: an `id`, a `config`, and optional `onBeforeEnter` / `onAfterEnter` / `onBeforeLeave` / `onAfterLeave` / `onSwitchedTo` / `onSwitchedAwayFrom` hooks.

## Content shell

The overlay's own markup is yours; these directives give it the standard regions and let the runtime know what it has:

```html
<div etOverlayHeader>
  <h2 etOverlayTitle>Edit product</h2>
  <button etOverlayClose type="button">Close</button>
</div>

<et-overlay-body dividers="dynamic">
  <form>…</form>
</et-overlay-body>

<div etOverlayFooter>
  <button [etOverlayClose]="'saved'" type="button">Save</button>
</div>
```

| Piece                                     | Purpose                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `[etOverlayHeader]` / `et-overlay-header` | Sticky header region.                                                                                                           |
| `[etOverlayTitle]`                        | The heading; wires `aria-labelledby` for the overlay.                                                                           |
| `[etOverlayClose]` / `[et-overlay-close]` | Closes the overlay. The bound value becomes the result.                                                                         |
| `et-overlay-body`                         | The scrolling region. `dividers` takes `'static'`, `'dynamic'` or `false` (default).                                            |
| `[etOverlayFooter]` / `et-overlay-footer` | Sticky footer region.                                                                                                           |
| `[etOverlayMain]`                         | Marks the main scroll container when your layout isn't header/body/footer. Nesting two enabled ones in the same overlay throws. |

`dividers="dynamic"` shows the header/footer separators only while the body is actually scrolled away from that edge; `"static"` always shows them.

These directives find their overlay through DI, falling back to the closest open overlay by DOM position - so they also work inside a component that is projected several levels down.

## Routing inside an overlay

An overlay can hold its own little router, so a multi-step flow stays in one overlay instead of opening a stack of them. Provide routes and render an outlet:

```ts
providers: [
  provideOverlayRouterConfig({
    routes: [
      { path: '/', component: OverviewComponent },
      { path: '/details', component: DetailsComponent },
    ],
  }),
],
```

```html
<et-overlay-router-outlet />
<a etOverlayRouterLink="/details">Details</a>
<button etOverlayBackOrClose type="button">Back</button>
```

<StoryEmbed id="cdk-overlay-overlay-routing--default" height="420px" />

Import `OverlayWithRoutingImports` for these. Highlights:

- Navigation is reflected in the browser URL, so the back button steps through the overlay's routes rather than leaving the page. `closeOnNavigation` is forced off while a router is present.
- `[etOverlayBackOrClose]` goes back one route, or closes the overlay when there is nowhere to go back to - the one control you need for a header.
- Transitions come in `'slide'`, `'fade'`, `'overlay'`, `'vertical'` and `'none'`.
- `ng-template[etOverlayHeaderTemplate]` inside a route replaces the overlay's header while that route is active, and `et-overlay-route-header-template-outlet` renders it - so a header can animate along with the route change.
- `ng-template[etOverlaySharedRouteTemplate]` + `et-overlay-shared-route-template-outlet` keep one piece of markup mounted across route changes.
- `ng-template[etOverlayRouterOutletDisabledTemplate]` is what renders when the outlet's `disabled` input is set - used by the sidebar below.

## Sidebar

`SidebarOverlayService` turns a routed overlay into a master/detail layout: a sidebar next to the content on wide viewports, and a separate navigable page on narrow ones. Import `OverlayWithSidebarImports`.

```ts
providers: [provideSidebarOverlayConfig({ renderSidebarFrom: 'md', sidebarPageRoute: '/sidebar' })],
```

Above `renderSidebarFrom` (default `'md'`) the sidebar renders inline via `et-overlay-sidebar`; below it, the same content becomes the `/sidebar` route reachable through `et-overlay-sidebar-page`. You write the content once.

## Unsaved-changes guard

`createOverlayDismissChecker` blocks dismissal while a form is dirty, so a backdrop click doesn't throw away a half-filled form:

```ts
const checker = createOverlayDismissChecker({
  form: this.form,
  dismissCheckFn: () => confirm('Discard your changes?'),
});
```

It compares the form's current value against `defaultValue` (the form's raw value at creation by default) and runs your check only when they differ. `dismissEvents` picks which dismissals are guarded - `backdropClick`, `escapeKey` and `closeCall` (an explicit `overlayRef.close()`), all `true` by default. The returned ref has `destroy()` and `refreshDefaultFormValue()` - call the latter after a request fills in the remaining defaults, or every later dismissal will look like an unsaved change.

## The overlay ref

`OverlayRef` is what `open()` returns and what the overlay component injects:

| Member                                | Purpose                                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `close(result?, force?)`              | Close, optionally with a result. `force` bypasses `disableClose` and the dismiss checker. |
| `afterOpened()`                       | Emits once the enter animation is done.                                                   |
| `beforeClosed()` / `afterClosed()`    | Emit the result before / after the leave animation.                                       |
| `backdropClick()` / `keydownEvents()` | Raw interaction streams.                                                                  |
| `updatePosition(position?)`           | Re-position a global-strategy overlay.                                                    |
| `componentInstance` / `componentRef`  | The mounted component.                                                                    |
| `id`, `config`, `disableClose`        | Identity and the resolved config.                                                         |

`injectOverlayManager()` exposes the whole stack: `openOverlays` (a signal), `closeAll()` and `getOverlayById(id)`.

## Accessibility

The container renders as `role="dialog"` (or `alertdialog`) with `aria-modal`, and CDK's focus trap keeps <kbd>Tab</kbd> inside it. On open, focus moves per `autoFocus` - `'first-tabbable'` by default, and `delayFocusTrap` holds that until the enter animation finishes so focus doesn't land on a moving target. On close, focus returns to whatever was focused before, which is why `restoreFocus` should stay on.

<kbd>Escape</kbd> and backdrop clicks close the overlay unless `disableClose` is set or a [dismiss checker](#unsaved-changes-guard) intervenes. Use `[etOverlayTitle]` rather than a bare `<h2>` - it is what labels the dialog for screen readers.

Reach for `role="alertdialog"` only for a confirmation that interrupts a destructive action, and give it `ariaDescribedBy` pointing at the explanatory text.

## Styling

The structural styles ship in the CDK's [global stylesheet](/cdk/#styles). Each strategy adds its own container class - `et-overlay--dialog`, `et-overlay--bottom-sheet`, `et-overlay--anchored-dialog` and so on - and the config's `containerClass`, `paneClass`, `overlayClass`, `backdropClass`, `bodyClass` and `documentClass` let you hang styles on the pane, the backdrop, `<body>` and `<html>` for the duration of the overlay.

Style the content regions against `et-overlay-header`, `et-overlay-body` (with `--render-dividers`, `--dynamic-dividers`, and the `et-scrollable-body--*` scroll-state classes), `et-overlay-footer` and `et-overlay-main`.
