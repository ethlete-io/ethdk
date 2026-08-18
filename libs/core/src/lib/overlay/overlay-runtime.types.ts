import { Binding, Injector, Signal, StaticProvider, Type, ViewContainerRef } from '@angular/core';
import { OffsetOptions, Padding, Placement, VirtualElement } from '@floating-ui/dom';
import { AnimatedLifecycleDirective } from '../animations';

export type OverlayRuntimeRole = 'dialog' | 'alertdialog';

export type OverlayRuntimeAutoFocusTarget = 'container' | 'first-heading' | 'first-tabbable';

export type OverlayRuntimeCloseSource = 'api' | 'escape' | 'outside-pointer' | 'drag' | 'reference-detached';

export type OverlayRuntimeCenteredPosition = {
  kind: 'center';
};

export type OverlayRuntimeGlobalPositionAlignment = 'start' | 'center' | 'end' | 'stretch';

export type OverlayRuntimeGlobalPosition = {
  kind: 'global';
  /** Horizontal placement of the pane inside the viewport. Defaults to `center`. */
  horizontal?: OverlayRuntimeGlobalPositionAlignment;
  /** Vertical placement of the pane inside the viewport. Defaults to `center`. */
  vertical?: OverlayRuntimeGlobalPositionAlignment;
  /** Padding applied to the host element. Defaults to `0`. */
  padding?: string;
};

export type OverlayRuntimeShiftOptions = {
  /**
   * Also shift along the placement's cross axis (e.g. horizontally for a `right-*` placement)
   * when no placement fits the viewport. The pane may then overlap its reference element -
   * desirable for nested menus, usually not for tooltips. Defaults to `false`.
   */
  crossAxis?: boolean;
};

export type OverlayRuntimeAnchoredPosition = {
  kind: 'anchored';
  referenceElement: HTMLElement | VirtualElement;
  placement?: Placement;
  fallbackPlacements?: Placement[];
  offset?: OffsetOptions | null;
  arrowPadding?: Padding | null;
  viewportPadding?: Padding | null;
  autoResize?: boolean;
  /**
   * Keeps the pane on its placement's own side while that side offers at least this much space (px
   * along the placement's main axis), instead of flipping as soon as the pane's content would
   * overflow. Below the minimum the pane moves to the opposite side, and when neither side reaches
   * it the roomier one wins. Requires `autoResize` - the pane has to shrink into what it gets.
   *
   * Prefer this over `fallbackPlacements` for a pane whose content is scrollable (a listbox, a
   * menu): a shorter list under the field beats a full-height one above it, and the decision reads
   * only the space around the reference, never the pane's own size. `flip` compares that size
   * against the space it has while `autoResize` derives it from the placement `flip` picked, so a
   * pane whose height changes while open - a filtered list, an animated resize - flips back and
   * forth mid-animation. Replaces `flip`, so `fallbackPlacements` no longer applies, and forces
   * `shift`'s cross axis off - a pane that shrinks into its side must not slide over the reference
   * element instead.
   */
  minAvailableSpace?: number;
  shift?: boolean | OverlayRuntimeShiftOptions;
  autoHide?: boolean;
  autoCloseIfReferenceHidden?: boolean;
  mirrorWidth?: boolean;
  /**
   * Clipping element(s) the pane must stay within when flipping/shifting, instead of the default
   * viewport (`clippingAncestors`). Use it to keep an anchored pane inside a specific region - e.g.
   * a rich-text editor's content area, so its selection toolbar flips below rather than covering the
   * static toolbar above.
   */
  boundary?: Element | Element[];
};

export type OverlayRuntimePositionStrategy =
  OverlayRuntimeCenteredPosition | OverlayRuntimeAnchoredPosition | OverlayRuntimeGlobalPosition;

export type OverlayRuntimeElements = {
  rootElement: HTMLElement;
  hostElement: HTMLElement;
  /** Present only while the overlay has a backdrop - a strategy switch can add or remove it. */
  backdropElement: Signal<HTMLElement | null>;
  paneElement: HTMLElement;
};

export type OverlayRuntimeCloseEvent<TResult = unknown> = {
  result: TResult | undefined;
  source: OverlayRuntimeCloseSource;
};

/**
 * A synchronous veto for a pending close. Return `false` to cancel the close (the overlay stays
 * open); return `true` to let it proceed. Registered via `overlayRef.registerCloseGuard`. An async
 * decision (e.g. a confirm dialog) lives in the guard's owner, which re-issues the close through
 * `overlayRef.forceClose` once resolved. `reference-detached` closes bypass all guards.
 */
export type OverlayRuntimeCloseGuard<TResult = unknown> = (event: OverlayRuntimeCloseEvent<TResult>) => boolean;

export type OverlayRuntimeComponentBase = {
  animatedLifecycle?: Signal<AnimatedLifecycleDirective | undefined>;
};

export type OverlayRuntimeAnimationDelegateEnterContext = {
  lifecycle: AnimatedLifecycleDirective;
  elements: OverlayRuntimeElements;
};

export type OverlayRuntimeAnimationDelegateLeaveContext = OverlayRuntimeAnimationDelegateEnterContext & {
  closeEvent: OverlayRuntimeCloseEvent;
};

/**
 * Overrides the runtime's default enter/leave animation handling.
 * A delegate must eventually drive the lifecycle state to `entered` (enter) or `left` (leave),
 * otherwise the overlay will never finish opening or closing.
 */
export type OverlayRuntimeAnimationDelegate = {
  enter?: (context: OverlayRuntimeAnimationDelegateEnterContext) => void;
  leave?: (context: OverlayRuntimeAnimationDelegateLeaveContext) => void;
};

export type OverlayRuntimeMountConfig<TComponent extends object> = {
  id: string;
  component: Type<TComponent>;
  viewContainerRef?: ViewContainerRef;
  injector?: Injector;
  providers?: StaticProvider[];
  role?: OverlayRuntimeRole;
  positionStrategy?: OverlayRuntimePositionStrategy;
  hasBackdrop?: boolean;
  modal?: boolean;
  autoFocus?: OverlayRuntimeAutoFocusTarget | string | false;
  restoreFocus?: boolean;
  closeOnEscape?: boolean;
  closeOnOutsidePointer?: boolean;
  ariaDescribedBy?: string | null;
  ariaLabelledBy?: string | null;
  ariaLabel?: string | null;
  hostClass?: string[];
  backdropClass?: string[];
  paneClass?: string[];
  /**
   * Bindings applied to the mounted component, using Angular's native binding API
   * (`inputBinding`, `outputBinding`, `twoWayBinding`).
   */
  bindings?: Binding[];
  animationDelegate?: OverlayRuntimeAnimationDelegate;
  /**
   * The document the overlay mounts into, when it is not the application's own - e.g. an overlay
   * opened from an element that was adopted by a same-origin pop-up window. The runtime root, the
   * close listeners and all focus handling follow this document.
   */
  document?: Document;
  /**
   * The stacking level of the runtime root this overlay mounts into. Overlays sharing a level share
   * a root and stack in open order; a higher level always paints over a lower one. Defaults to
   * `DEFAULT_OVERLAY_LAYER` - raise it only for an overlay opened from something that itself paints
   * above that level, and prefer declaring it once on that element with `data-et-overlay-layer`.
   */
  zIndex?: number;
};
