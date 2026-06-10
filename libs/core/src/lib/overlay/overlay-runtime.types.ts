import { Injector, Signal, StaticProvider, Type, ViewContainerRef } from '@angular/core';
import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';
import { AnimatedLifecycleDirective } from '../animations';

export type OverlayRuntimeRole = 'dialog' | 'alertdialog';

export type OverlayRuntimeAutoFocusTarget = 'container' | 'first-heading' | 'first-tabbable';

export type OverlayRuntimeCloseSource = 'api' | 'escape' | 'outside-pointer';

export type OverlayRuntimeCenteredPosition = {
  kind: 'center';
};

export type OverlayRuntimeAnchoredPosition = {
  kind: 'anchored';
  referenceElement: HTMLElement;
  placement?: Placement;
  fallbackPlacements?: Placement[];
  offset?: OffsetOptions | null;
  arrowPadding?: Padding | null;
  viewportPadding?: Padding | null;
  autoResize?: boolean;
  shift?: boolean;
  autoHide?: boolean;
  autoCloseIfReferenceHidden?: boolean;
  mirrorWidth?: boolean;
};

export type OverlayRuntimePositionStrategy = OverlayRuntimeCenteredPosition | OverlayRuntimeAnchoredPosition;

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
  inputBindings?: Record<string, unknown>;
};
