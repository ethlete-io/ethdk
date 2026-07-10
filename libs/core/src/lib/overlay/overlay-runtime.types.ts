import { Binding, Injector, Signal, StaticProvider, Type, ViewContainerRef } from '@angular/core';
import { OffsetOptions, Padding, Placement, VirtualElement } from '@floating-ui/dom';
import { AnimatedLifecycleDirective } from '../animations';

export type OverlayRuntimeRole = 'dialog' | 'alertdialog';

export type OverlayRuntimeAutoFocusTarget = 'container' | 'first-heading' | 'first-tabbable';

export type OverlayRuntimeCloseSource = 'api' | 'escape' | 'outside-pointer' | 'drag';

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
   * when no placement fits the viewport. The pane may then overlap its reference element —
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
  shift?: boolean | OverlayRuntimeShiftOptions;
  autoHide?: boolean;
  autoCloseIfReferenceHidden?: boolean;
  mirrorWidth?: boolean;
};

export type OverlayRuntimePositionStrategy =
  | OverlayRuntimeCenteredPosition
  | OverlayRuntimeAnchoredPosition
  | OverlayRuntimeGlobalPosition;

export type OverlayRuntimeElements = {
  rootElement: HTMLElement;
  hostElement: HTMLElement;
  backdropElement: HTMLElement | null;
  paneElement: HTMLElement;
};

export type OverlayRuntimeCloseEvent<TResult = unknown> = {
  result: TResult | undefined;
  source: OverlayRuntimeCloseSource;
};

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
};
