import { Injector, StaticProvider, ViewContainerRef } from '@angular/core';
import { OverlayRuntimePositionStrategy } from '@ethlete/core';

export type OverlayAutoFocusTarget = 'container' | 'first-heading' | 'first-tabbable';

export type OverlayRole = 'dialog' | 'alertdialog';

export type OverlayMode = 'modal' | 'non-modal';

export type OverlayPositionStrategy = OverlayRuntimePositionStrategy;

export type OverlayConfig<TD = unknown> = {
  viewContainerRef?: ViewContainerRef;
  injector?: Injector;
  id?: string;
  origin?: HTMLElement;
  role?: OverlayRole;
  positionStrategy?: OverlayPositionStrategy;
  hasBackdrop?: boolean;
  disableClose?: boolean;
  data?: TD | null;
  ariaDescribedBy?: string | null;
  ariaLabelledBy?: string | null;
  ariaLabel?: string | null;
  autoFocus?: OverlayAutoFocusTarget | string | false;
  restoreFocus?: boolean;
  providers?: StaticProvider[];
  hostClass?: string | string[];
  backdropClass?: string | string[];
  panelClass?: string | string[];
  mode?: OverlayMode;
  closeOnOutsidePointer?: boolean;
  closeOnEscape?: boolean;
};
