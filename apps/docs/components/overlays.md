# Overlays

The overlay system is the foundation for everything floating in `@ethlete/components` - dialogs, sheets, popovers, and internally also [menus](/components/menu), [tooltips](/components/tooltip) and [toggletips](/components/toggletip). It renders a component (or template) in a detached pane, positions it (centered, anchored, or strategy-driven), and manages backdrop, focus, dismissal and animations. Under the hood it drives the [overlay runtime](/core/overlay-runtime) from `@ethlete/core` - relevant only if you're building your own floating primitive.

::: warning Prefer overlay openers - don't call the manager directly
Almost no app code should reach for `overlayManager.open()`. Define the overlay once with
`defineOverlay` + `createOverlayOpener` and open **that** - it removes the repeated config,
handles subscription cleanup, and gives you typed data in and results out. See
[Overlay openers](/components/overlay-openers).

This page documents the layer underneath: the manager, config and refs an opener wraps. Read it
to understand what the openers do, or for the rare overlay opened from exactly one place with no
lifecycle callbacks.
:::

## Setup

Call `provideOverlay()` once at bootstrap - it registers the scroll blocker that locks body scroll while overlays are open:

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

Again: this is the raw layer - in app code, prefer an [overlay opener](/components/overlay-openers) over the snippet above.

Defaults worth knowing:

| Option                                   | Default                                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `mode`                                   | `'modal'` - set `'non-modal'` for popover-style overlays                                                                   |
| `role`                                   | `'dialog'` when modal                                                                                                      |
| `hasBackdrop`                            | The strategy's own default when it sets one, otherwise follows `mode` (modal → backdrop)                                   |
| `closeOnEscape`, `closeOnOutsidePointer` | `true`; `disableClose: true` forces both off                                                                               |
| Position                                 | Anchored to `origin` when it's an element, otherwise centered                                                              |
| `origin` (with strategies)               | Falls back to the currently focused element (used as transform origin too)                                                 |
| `customAnimated`                         | `false` - set `true` to disable the built-in animations and drive your own via the [animation lifecycle](/core/animations) |
| `zIndex`                                 | The level declared by the nearest `data-et-overlay-layer` ancestor of `origin`, else `2147483003`                          |

Data goes in via `bindings` (Angular's `inputBinding` / `outputBinding` / `twoWayBinding`) and `providers` - see [passing data](/components/overlay-openers#passing-data-into-the-overlay).

Popovers stack safely: a pane opened from **inside** another overlay (a select body, menu or tooltip within a dialog or anchored panel) renders as a sibling in the overlay root, but the parent still treats a pointer interaction with it as "inside". Clicking a nested popover never dismisses the overlay that opened it - dismissal is resolved against the whole nested tree, anchored by each pane's `origin`.

Open order decides what paints on top, and one stacking level is all an app needs. Something that must sit above _every_ overlay - a devtools panel, an always-on-top widget - declares its own level with `data-et-overlay-layer` and every overlay opened from inside it follows, resolved from `origin`. `zIndex` on a single `open()` does it for a one-off. See [stacking levels](/core/overlay-runtime#stacking-levels).

A press on such a higher level is never an outside press either: working in a devtools panel leaves an open dialog, sheet, menu or select alone. See [a press on a level above](/core/overlay-runtime#a-press-on-a-level-above-never-closes-what-is-below).

### The overlay ref

The `OverlayRef` is returned by `open` and injectable inside the overlay via the `OVERLAY_REF` token (or, with openers, via `definition.injectRef()`):

- `close(result?)` - close with an optional typed result
- `afterOpened()`, `beforeClosed()`, `afterClosed()` - one-shot observables
- `afterClosedEvent()` - like `afterClosed()`, but the emitted event also carries `source`
  (`'api' | 'escape' | 'outside-pointer' | 'drag' | 'reference-detached'`) - e.g. to restore focus
  on an explicit dismiss without stealing it from whatever an outside-pointer close was aimed at
- `componentInstance()` - the content component instance
- `updatePositionStrategy(strategy)` - reposition without remounting
- `registerCloseGuard(guard)` - veto pending closes synchronously (returns an unregister fn); `forceClose(source?, result?)` commits a close bypassing all guards. These are the low-level seam behind `createOverlayUnsavedChangesGuard` (below) - reach for that instead of wiring guards by hand
- `id`, `config`, `elements` (`paneElement` / `hostElement` / `backdropElement()`) - identity and DOM access. `backdropElement` is a signal because a strategy switch can add or remove the backdrop

The manager also exposes an `openOverlays` computed with every currently open ref.

## Guarding against accidental dismissal

An overlay that hosts a form should not silently throw away unsaved edits when the user clicks the backdrop, hits <kbd>Escape</kbd>, drags the sheet away, or a programmatic `close()` runs. `createOverlayUnsavedChangesGuard` (the overlay flavor of the [`unsavedChanges` family](/core/utilities#unsaved-changes)) handles exactly this: called from the overlay content component's injection context, it injects the current `OVERLAY_REF`, and while the watched form differs from its baseline it **vetoes** the close, runs your async `confirm`, and only re-issues the close if the user agrees. In a [routed overlay](#routing-inside-overlays) it guards route changes away from the page the same way, so a form on a route needs no separate navigation guard.

```ts
import { createOverlayUnsavedChangesGuard, injectOverlayManager, OVERLAY_REF } from '@ethlete/components';
import { form } from '@angular/forms/signals';

@Component({/* … */})
export class EditItemOverlayComponent {
  private overlays = injectOverlayManager();
  private overlayRef = inject(OVERLAY_REF);

  protected form = form(signal({ title: '', notes: '' }));

  private guard = createOverlayUnsavedChangesGuard({
    source: this.form, // a signal-forms FieldTree (also: Signal<FieldTree | null>, AbstractControl, WritableSignal)
    confirm: (value, { signal }) => {
      const ref = this.overlays.open(ConfirmDiscardComponent); // truthy result = discard
      signal.addEventListener('abort', () => ref.close(false)); // the session ended - don't strand it
      return ref.afterClosed();
    },
  });

  protected save() {
    // persist…, then re-baseline so the just-saved state no longer counts as unsaved
    this.guard.refreshDefaultValue();
    this.overlayRef.close(this.form().value());
  }
}
```

- **`source`** is a signal-forms `FieldTree` (first-class), a `Signal<FieldTree | null>` for late/async forms, an `AbstractControl`, or a plain `WritableSignal`. Changes are detected by a deep-equal snapshot against a baseline - editing a field and reverting it is clean again (unlike signal-forms' `dirty()`).
- **`confirm`** is required per call site and runs **only** when there are actual changes. Return a boolean, `Promise`, or `Observable` - a truthy result allows the discard.
- **`refreshDefaultValue()`** re-baselines to the current value; call it after a save that keeps the overlay open. **`restoreDefaultValue()`** reverts the form to the baseline.
- **`dismissSources`** opts individual sources out (`{ outsidePointer, escape, closeCall, drag }`, all `true` by default). With `disableClose`, only a programmatic `close()` can reach the guard.
- **`guardRouteChanges`** (default `true`) additionally vetoes [overlay router](#guarding-navigation) navigations away from the page holding the guard, so in a routed overlay one call covers both ways the edits can be lost - moving to another route and dismissing the overlay - and both go through the same `confirm`. Set it to `false` for a page whose edits survive a route change. It does nothing when the overlay has no router.
- **`tab`** - while the form is dirty the guard also locks the **browser tab** (`beforeunload`), since closing or reloading the tab bypasses the overlay runtime entirely. Opt into a tab title marker, a blinking marker, a favicon dot or an app badge, or disable it with `tab: false` - see [Guarding the browser tab](/core/utilities#unsaved-changes-tab).
- **Only one confirm shows at a time**, app-wide, and a logout releases the guard instead of stranding the dialog over the login page - wire `confirm`'s `signal` to close your dialog, see [Sessions ending underneath a guard](/core/utilities#unsaved-changes-coordinator).
- The guard auto-cleans up on injector destroy; call `guard.destroy()` to stop guarding earlier.

For route-level protection (a form on a page rather than in an overlay) use [`createUnsavedChangesGuard`](/core/utilities#unsaved-changes) from `@ethlete/core`, which adds a `canDeactivate` bridge.

<StoryEmbed id="components-overlays-overlay-unsaved-changes--default" height="520px" />

## Live demo

<StoryEmbed id="components-overlays-overlay--default" height="480px" />

## Building overlay content

Import `OVERLAY_CONTENT_IMPORTS` into the overlay component and structure it with the content pieces - a grid layout with pinned header/footer and a scrolling body:

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

The header, body, and footer must have an `etOverlayMain` ancestor - either an `<et-overlay-main>` element (as above) or a host applying the directive via `hostDirectives` (`etOverlayMain` sits equally well on a `<form>` that wraps the body). Using any of them without a main throws [`ET1208`](/components/error-codes). The main may live on the routed page rather than the overlay component itself - see [Routing inside overlays](#routing-inside-overlays).

| Piece                    | Selector                               | Purpose                                                                                                                  |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `OverlayMainDirective`   | `[etOverlayMain]`                      | Layout wrapper enabling pinned header/footer + scrolling body; often applied via `hostDirectives`                        |
| `OverlayHeaderDirective` | `[etOverlayHeader]`                    | Pinned header region                                                                                                     |
| `OverlayBodyComponent`   | `et-overlay-body`, `[et-overlay-body]` | Scrollable body; `dividers: 'static' \| 'dynamic' \| false` shows edge dividers while scrolled; `scrollToTop(behavior?)` |
| `OverlayFooterDirective` | `[etOverlayFooter]`                    | Pinned footer region                                                                                                     |
| `OverlayTitleDirective`  | `[etOverlayTitle]`                     | Wires the overlay's `aria-labelledby` to the title element                                                               |
| `OverlayCloseDirective`  | `[etOverlayClose]`                     | Click closes the nearest overlay; the bound value becomes the close result                                               |

Spacing is tokenized, so an overlay can retune it per instance via `panelClass` without restyling the pieces:

| Token                                     | Default   | Applies to                                                                |
| ----------------------------------------- | --------- | ------------------------------------------------------------------------- |
| `--et-overlay-padding-inline`             | `16px`    | Inline padding of header, body and footer                                 |
| `--et-overlay-padding-block`              | `16px`    | Block padding at the pane's outer edges (header start, footer end)        |
| `--et-overlay-header-padding-block-end`   | `16px`    | Gap between the header and the body                                       |
| `--et-overlay-body-padding-block`         | `0`       | Block padding inside the scrolling body                                   |
| `--et-overlay-footer-padding-block-start` | `16px`    | Gap between the body and the footer                                       |
| `--et-overlay-body-min-block-size`        | `100px`   | Floor for the body's row before the pane starts scrolling                 |
| `--et-overlay-body-divider-color`         | `#565656` | The body's edge dividers (`dividers`) and the sidebar's inline-end border |

`--et-overlay-body-padding-block` is applied to the body's inner wrapper rather than to the scroll container itself, so its end value is part of the scrollable area: content scrolled to the bottom stops that far short of the edge instead of ending flush against the divider, which would clip the last child's border and focus ring.

### Pane surface

The boxed overlay kinds - `dialog`, `anchoredDialog`, the four sheets and the full-screen dialog - paint a default surface on the pane itself, so plain content (header/body/footer) needs no styling of its own. The colors come from the [surface theme](/core/theming) at the pane's elevation:

- **Background & text** from `--et-surface-background-solid` / `--et-surface-color-solid`.
- **Border** (`0.1rem` of `--et-surface-border-solid`) - all around for dialogs; on a bottom/top sheet every edge but the docked one; on a side sheet only the exposed inner edge (its block edges sit flush against the viewport).
- **Radius** on the exposed corners - `1.6rem` for dialogs and sheets, `1.2rem` for the anchored dialog. The full-screen dialog stays square (its radius is animated from the origin).

Content inherits the radius through the pane, and the anchored-dialog arrow reads the pane's real background and border so it matches. Anchored/centered panes (menu, tooltip, select, date-picker, …) are deliberately excluded - they paint their own surface.

Every overlay resolves its elevation one level **above the surface its trigger sits on**, found from the trigger's nearest surface ancestor in the DOM. This works across the portal boundary: a `select` opened from inside a dialog (elevation 1) mounts at elevation 2, a picker anchored to a field inside an elevated card elevates above the card, and a submenu elevates above its parent menu. An overlay with a backdrop is the exception - the backdrop resets the visual context, so it always mounts at elevation 1. That is resolved from the same `hasBackdrop` the overlay mounted with, so a strategy that turns the backdrop off (the anchored dialog) keeps elevating above its trigger even in the default modal mode.

Override per instance via `panelClass` and the pane tokens:

| Token                               | Default                         |
| ----------------------------------- | ------------------------------- |
| `--et-overlay-surface-background`   | `--et-surface-background-solid` |
| `--et-overlay-surface-color`        | `--et-surface-color-solid`      |
| `--et-overlay-surface-border-color` | `--et-surface-border-solid`     |
| `--et-overlay-surface-border-width` | `0.1rem`                        |
| `--et-overlay-radius`               | `1.6rem`                        |

The backdrop behind a modal overlay dims independently of the pane's own surface:
`--et-overlay-backdrop-color` (default `rgb(0 0 0 / 0.32)`).

## Strategies

A strategy controls the overlay's position, sizing, classes and animation. Pass one via `config.strategies`:

| Factory                                                  | Shape                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `dialogOverlayStrategy`                                  | Centered dialog (`width: min(512px, 80%)` by default)             |
| `fullScreenDialogOverlayStrategy`                        | Full-screen, animates from the origin element                     |
| `bottomSheetOverlayStrategy`                             | Bottom sheet, drag-to-dismiss downwards                           |
| `topSheetOverlayStrategy`                                | Top sheet, drag-to-dismiss upwards                                |
| `leftSheetOverlayStrategy` / `rightSheetOverlayStrategy` | Side sheets, drag-to-dismiss sideways                             |
| `anchoredDialogOverlayStrategy`                          | Anchored popover next to `origin` (floating-ui), arrow by default |
| `centeredOverlayStrategy`                                | Plain centered pane with size overrides                           |

Every factory accepts a partial `OverlayBreakpointConfig` (sizes, classes, `dragToDismiss`, `hasBackdrop`, `arrow`, …). Its `documentClass` and `bodyClass` land on elements every overlay shares, so they are reference counted: two open overlays asking for the same document class keep it until the last of them closes.

Size a non-anchored overlay in percentages rather than viewport units (`80%`, not `80vh`). The pane fills a cell that spans the space an overlay may use, which is the viewport minus whatever [reserved it](/core/overlay-runtime#reserved-viewport-space) - a docked devtools panel, for example. `vh` and `vw` measure the whole window instead, so a pane sized that way can reach under such a surface. This is why the dialog and sheet defaults are percentages.

### Strategy stylesheets

A strategy's default enter/leave animation ships with the strategy rather than with the overlay container: each built-in factory sets `stylesComponent` on its config, and the container mounts that stylesheet while the strategy is active. An app therefore only carries the animation CSS for the overlay shapes it actually opens.

The consequence is for hand-rolled strategies: an overlay that sets a layout `containerClass` of its own (instead of composing a built-in factory) gets no default animation unless it points `stylesComponent` at a styles-only component of its own - a `@Component` with an empty template, `ViewEncapsulation.None` and the animation rules in its `styleUrl`.

`anchoredDialogOverlayStrategy` enters and leaves with the same scale-and-fade the plain dialog uses, but around a `transform-origin` set to the origin element's center - so the pane grows out of its trigger without ever taking the trigger's dimensions. Scaling _to the origin's width and height_ reads as the trigger morphing into the pane, which is what the full-screen dialog does and an anchored dialog does not: it appears beside its origin and stays a separate surface. `applyTransformOrigin` (default `true`) is what computes and writes that origin point; set it to `false` to scale from the pane's own center instead.

### Drag-to-dismiss direction

`dragToDismiss.direction` takes either a physical direction (`'to-top'`, `'to-bottom'`, `'to-left'`, `'to-right'`) or a **logical** one (`'to-inline-start'`, `'to-inline-end'`). Logical values are resolved against the overlay container's computed `direction` when the gesture is attached, so they follow the writing direction the same way the `horizontal: 'start' | 'end'` position strategies do - a side sheet stays draggable toward the edge it is docked to under `dir="rtl"`. The side-sheet strategies use the logical values by default; physical values keep meaning exactly what they say.

### How the gesture behaves

The gesture runs on pointer events, so touch, pen and mouse take one code path. It only starts following the pointer after 8px of travel along the dismiss axis. That threshold is deliberate: within it the browser is still free to claim the gesture as a scroll, so a swipe that begins on scrolled overlay content scrolls that content instead of dragging the sheet. A gesture the browser does take over (or one that starts on an `input`, `button` or link) leaves the sheet where it was.

A drag surface inside the sheet keeps its own gesture: the sheet skips any pointerdown whose target sits under an element that has taken the dismiss axis with `touch-action`. That is the same declaration the browser reads, so nothing extra is needed to opt out - a color picker area at `touch-action: none` and a vertical slider at `pan-x` both keep a downward drag to themselves, while a horizontal slider at `pan-y` leaves the vertical axis to the bottom sheet.

On release the sheet either settles back or leaves, decided by `minDistanceToDismiss` (150px) and `minVelocityToDismiss` (150px/s) - either one is enough. Release velocity is measured over the last 100ms of the gesture rather than averaged across it, so a slow drag that ends in a flick dismisses, and a fast drag parked before release does not.

Both the settle and the exit animate at the speed the pointer had when it let go, clamped to 100–350ms - the sheet is thrown, not handed to a fixed transition. Under `prefers-reduced-motion` the momentum handoff is skipped and the stylesheet's own durations apply.

### Snap points

`dragToDismiss.snapPoints` turns the two-state gesture into a multi-position one. Points are fractions of the sheet's own size along the dismiss axis, where `0` is fully docked:

```ts
this.overlayManager.open(ExampleOverlayComponent, {
  strategies: bottomSheetOverlayStrategy({
    dragToDismiss: { direction: 'to-bottom', snapPoints: [0, 0.4, 0.7] },
  }),
});
```

A flick advances one point in its own direction; a slow release settles at the nearest one. Running past the last point dismisses the sheet. The docked position is always available whether or not `0` is listed, and values outside `[0, 1)` are ignored.

The sheet keeps its full size at every snap point - only its offset changes, so a sheet parked at `0.7` has 70% of its height below the viewport edge. Content that should reflow or scroll differently at a partial position is yours to handle.

### Responsive (transforming) strategies

`strategies` is an array of `{ breakpoint?, strategy }` entries - the controller picks the entry matching the current `min-width` and **switches live on resize without remounting** the content. Breakpoint names come from the app's [viewport config](/core/providers#breakpoint-observer) (Tailwind-style `xs`–`2xl` by default). Presets cover the common pairs:

```ts
import { transformingBottomSheetToDialogOverlayStrategy } from '@ethlete/components';

this.overlayManager.open(ExampleOverlayComponent, {
  // bottom sheet below `md`, dialog from `md` upwards
  strategies: transformingBottomSheetToDialogOverlayStrategy({ breakpoint: 'md' }),
});
```

A switch carries the strategy's own `hasBackdrop` over too: morphing a backdropped bottom sheet into a backdrop-less anchored pane removes the backdrop and lets pointers through the host again, and the reverse adds one and fades it in. `config.hasBackdrop` still wins over every strategy, so set it only when the backdrop must stay the same at every breakpoint.

Also available: `transformingFullScreenDialogToDialogOverlayStrategy` and `transformingFullScreenDialogToRightSheetOverlayStrategy`. Custom combinations are just arrays - each strategy provider (e.g. `injectDialogStrategy()`) exposes `.build(config)`, and app-wide defaults can be tuned via `provideDialogStrategyDefaults` and friends.

Give the array one entry **without** a `breakpoint`: that is the base strategy, used below every breakpoint listed. An array whose entries all declare one falls back to its smallest entry and warns in dev mode; an empty array throws `ET1210`.

### Anchored overlays and the arrow

Anchored strategies position relative to `config.origin` using floating-ui (`placement`, `fallbackPlacements`, `offset`, `shift`, `autoHide`, …). With `arrow: true` (the `anchoredDialogOverlayStrategy` default) the pane renders an arrow pointing at the origin. The arrow takes its background and border from the [surface theme](/core/theming) so it reads as part of the panel - overridable via `--et-overlay-arrow-background` / `--et-overlay-arrow-border` / `--et-overlay-arrow-shadow` (default `none`) - and is the same arrow used by menus, tooltips and toggletips. Half of it hangs off the pane, so its two bordered sides end exactly where the pane's own border line resumes and the two read as one outline.

**`minAvailableSpace`** changes _when_ the pane switches sides. By default that is floating-ui's `flip`: as soon as the pane's content does not fit below the origin, it goes above. For a pane that scrolls - a listbox, a menu - the better trade is usually the opposite, and that is what `minAvailableSpace` expresses: keep the pane below while at least that many pixels are left there (`autoResize` shrinks it into them), switch sides only below the minimum, and take the roomier side when neither reaches it. It replaces `flip` (so `fallbackPlacements` no longer applies) and forces `shift`'s cross axis off, since a pane that shrinks into its side must not slide over the origin instead.

The reason to prefer it over `fallbackPlacements` for such a pane is stability: it measures the space around the origin, never the pane, so **an open pane cannot jump sides when its content changes**. `flip` compares the pane's current height against the space below it while `autoResize` derives that height from the placement `flip` just picked - a filtered list or an animated resize then flips the pane back and forth mid-animation. `et-select` and `et-cascader` both use it with a `160px` minimum.

`arrowPadding` (default `16` for `anchoredDialogOverlayStrategy`, `12` for a bare anchored strategy) is how close the arrow's base may get to the pane's corners. Keep it above the pane's corner radius: on aligned placements (`'bottom-end'`, `'left-start'`, …) and on panes shifted off center near a viewport edge, the arrow slides all the way to that limit, and a smaller value lets its base ride into the rounded corner.

## Color theme context

Overlay panes render in detached DOM, so a [color theme](/core/theming) scope around the trigger doesn't reach them through CSS inheritance. The overlay container re-applies the context itself: it syncs with the nearest color provider reachable through `config.viewContainerRef` / `config.injector` (openers created with `createOverlayOpener` pass the calling component's `ViewContainerRef` automatically), and otherwise falls back to a color provider on the bootstrapped root component - e.g. `ProvideColorDirective` added via `hostDirectives` on the app component. The pane keeps following that provider while open, so forcing a different color on it re-themes already-open overlays too.

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

- `[etOverlay]` - orchestrator; `open` is a two-way model, plus `show()` / `hide(result?)` / `toggle()`. Defaults to **non-modal** (the manager defaults to modal).
- `[etOverlayTrigger]` - click toggles, manages `aria-expanded`.
- `[etOverlayAnchor]` - optional separate positioning reference.
- `ng-template[etOverlaySurface]` - the content (required); context provides `close(result?)`.

```ts
import { OVERLAY_IMPORTS } from '@ethlete/components';
```

When an anchor/trigger exists (and mode is non-modal) the surface opens anchored; otherwise centered.

`[etOverlay]` mirrors most of the imperative config as inputs:

| Input                                        | Default       | Notes                                                               |
| -------------------------------------------- | ------------- | ------------------------------------------------------------------- |
| `mode`                                       | `'non-modal'` | `'modal'` adds backdrop + focus trap semantics                      |
| `role`                                       | -             | Overrides the mode-derived ARIA role                                |
| `disabled`                                   | `false`       | Ignores open requests while set                                     |
| `disableClose`                               | `false`       | Forces `closeOnEscape` / `closeOnOutsidePointer` off                |
| `closeOnEscape` / `closeOnOutsidePointer`    | `true`        |                                                                     |
| `hasBackdrop`                                | -             | Follows `mode` when unset                                           |
| `autoFocus` / `restoreFocus`                 | - / `true`    | Initial focus target; restore focus on close                        |
| `hostClass` / `backdropClass` / `panelClass` | -             | Extra classes per overlay element                                   |
| `placement`                                  | `'bottom'`    | floating-ui placement (anchored mode)                               |
| `fallbackPlacements`                         | -             | Tried when `placement` doesn't fit                                  |
| `offset` / `viewportPadding`                 | `8` / `8`     | Distance from anchor / viewport edges                               |
| `shift`                                      | `true`        | Slide along the axis to stay in the viewport                        |
| `autoResize`                                 | `false`       | Constrain size to the available space                               |
| `minAvailableSpace`                          | -             | Shrink into the current side above this many px instead of flipping |
| `autoHide`                                   | `false`       | Hide when the anchor leaves the viewport                            |
| `autoCloseIfReferenceHidden`                 | `false`       | Close instead of just hiding                                        |
| `mirrorWidth`                                | `false`       | Match the anchor's width (select-style panels)                      |

## Routing inside overlays

Multi-step overlays (wizards, settings dialogs) use the overlay router - an internal router independent of Angular's, optionally mirrored into the URL:

```ts
import { provideOverlayRouter } from '@ethlete/components';

this.overlayManager.open(SettingsOverlayComponent, {
  strategies: dialogOverlayStrategy({ width: 480, height: 'min(520px, 80%)' }),
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
- `[etOverlayBackOrClose]` goes back - or closes the overlay when there's no history.
- `ng-template[etOverlayHeaderTemplate]` in a page + `<et-overlay-route-header-template-outlet />` in the shared header lets each route supply its own header content.
- `ng-template[etOverlaySharedRouteTemplate]` + `<et-overlay-shared-route-template-outlet />` do the same for content shared across **all** routes (rendered wherever the outlet sits).
- `ng-template[etOverlayRouterOutletDisabledTemplate]` provides fallback content shown while the router outlet is disabled.
- `injectOverlayRouter()` gives programmatic access (`navigate`, `back`, `currentRoute`, …).
- `button[et-overlay-nav-tab-link]` inside `<et-nav-tabs>` gives the overlay a tab bar driven by this router instead of Angular's - see [nav tabs in an overlay](/components/tabs#nav-tabs-in-an-overlay).

**Which way a transition plays** follows the routes' order in the config: navigating to a route listed earlier plays backward, later plays forward - so a settings dialog or a stepper animates the way its bar reads, whichever direction the user came from. A route the config doesn't know falls back to the navigation's own semantics (`back()` is backward, everything else forward). Override per navigation with `navigate(route, { navigationDirection })`, or per route with the `navigationDirection: { to, from }` hint on the route itself; both win over route order. Only the animation is affected - `back()` and `canGoBack()` keep following the actual navigation history.

<StoryEmbed id="components-overlays-overlay-with-routing--default" height="520px" />

### Guarding navigation

`registerNavigationGuard(guard)` registers a check that runs before every route change - `navigate()`, `etOverlayRouterLink`, `back()`, and the ones the browser's back and forward buttons trigger. It returns a function that unregisters the check again:

```ts
import { DestroyRef, inject } from '@angular/core';
import { injectOverlayRouter } from '@ethlete/components';

@Component({/* … */})
export class MembersPageComponent {
  private router = injectOverlayRouter();

  constructor() {
    inject(DestroyRef).onDestroy(
      this.router.registerNavigationGuard(({ from, to }) => (this.hasUnsavedEdits() ? this.confirmDiscard() : true)),
    );
  }
}
```

- The guard receives `{ from, to }` - both resolved absolute paths - and returns `boolean | Promise<boolean>`. `false` cancels the navigation and leaves the current route rendered.
- Guards run **in registration order** and stop at the first veto, so a later guard never asks a question the first one already settled.
- Navigating to the route already showing consults no guard at all.
- For a **browser-driven** navigation the URL has already moved before anyone can veto, so a cancelled one puts the query param back on the route still being rendered.
- `router.navigationPending()` is `true` while a guard is deciding, and stays `true` until the committed route is observable on `currentRoute` a frame later. Use it to show progress or disable further navigation while a guard is asking its question.
- A nav tab link's selection follows the router rather than the click, so the underline stays on the current tab until the guard lets the navigation through - and never moves at all when one vetoes.
- A navigation stays **synchronous for as long as the guards do**, and goes async from the first one that returns a promise - a route change deferred by a microtask lands after the frame the outlet measured for its transition. Answer `true` synchronously on the paths that have nothing to ask about, rather than wrapping every answer in a promise.
- With `syncUrl: true`, `back()` delegates to browser history and returns `true` before any guard has run: its return value means "a back step was issued", not "the route changed".

**For a form that must not lose its edits, you usually want [`createOverlayUnsavedChangesGuard`](#guarding-against-accidental-dismissal) instead of registering this by hand** - in a routed overlay it registers a navigation guard alongside its close guard, so one call covers both ways out. Reach for `registerNavigationGuard` directly when the check is not about unsaved changes.

### Sidebar layouts

`provideSidebarOverlay(config?)` (requires the overlay router) adds a responsive sidebar: above `renderSidebarFrom` (default `'md'`, measured against the **pane** width) the `<et-overlay-sidebar>` renders inline next to the outlet (with each nav target as an `<et-overlay-sidebar-page>`); below it, the sidebar collapses into a navigable route of its own.

The overlay content only has to place the two pieces - the layout is the library's:

```html
<et-overlay-sidebar>
  <ng-template etOverlayHeaderTemplate>Settings</ng-template>
  <nav>…</nav>
</et-overlay-sidebar>

<et-overlay-router-outlet />
```

While it renders inline the sidebar is the content grid's first column and a flex column itself, so `margin-block-start: auto` on a child pushes it to the bottom. Collapsed, it leaves the grid entirely and the outlet is the only column - nothing to toggle by hand. Set `--et-overlay-sidebar-inline-size` (default `240px`) to change its width; its padding follows `--et-overlay-padding-inline` / `--et-overlay-padding-block` and its divider `--et-overlay-body-divider-color`.

## Accessibility

- **Role**: modal overlays default to `role="dialog"` (`config.role` accepts `'dialog' | 'alertdialog'`); non-modal overlays get no role unless you set one.
- **Name/description**: set `ariaLabel`, `ariaLabelledBy` or `ariaDescribedBy` in the config - or just use `[et-overlay-title]`, which auto-wires the overlay's `aria-labelledby` to the title element when nothing else names it.
- **Focus**: `autoFocus` targets `'container' | 'first-heading' | 'first-tabbable'`, a CSS selector, or `false`; `restoreFocus` (default `true`) returns focus to the opener on close. With the overlay router, each navigation re-applies initial focus to the new page (default `'first-tabbable'`), and `[etOverlayRouterLink]` sets `aria-current="page"` on the active link.
- **Dismissal & scroll**: `closeOnEscape` and `closeOnOutsidePointer` default to `true` (`disableClose` forces both off), and body scroll is locked while any overlay that is _modal_ or shows a _backdrop_ is open. A non-modal overlay that leaves the page visible - a tooltip, a popover, an anchored pane - never locks it. The two are checked separately because a breakpoint switch can add a backdrop to an overlay that is already open: a non-modal picker anchored to its field above `md` becomes a backdropped bottom sheet below it, and the page locks on the switch and unlocks again on the way back.
- **Escape from inside the overlay**: the escape listener runs in the bubble phase and skips an event that content already handled, so a control inside the pane can `preventDefault()` or `stopPropagation()` an <kbd>Escape</kbd> to consume it first - that is how the command palette clears its query before a second <kbd>Escape</kbd> closes it.
- **Reduced motion**: every built-in strategy's enter/leave animation is skipped under `prefers-reduced-motion` - the overlay still opens and closes, just without the transition.

## Error codes

Structural misuse (pieces outside `[etOverlay]`, missing surface, nested mains) throws [`ET12xx` errors](/components/error-codes#overlay-et12xx) - most in dev mode only.
