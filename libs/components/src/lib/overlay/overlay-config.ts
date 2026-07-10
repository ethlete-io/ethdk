import { Binding, Injector, StaticProvider, ViewContainerRef } from '@angular/core';
import { OverlayStrategyBreakpoint } from './strategies/overlay-strategy.types';

export type OverlayAutoFocusTarget = 'container' | 'first-heading' | 'first-tabbable';

export type OverlayRole = 'dialog' | 'alertdialog';

export type OverlayMode = 'modal' | 'non-modal';

export type OverlayConfig = {
  viewContainerRef?: ViewContainerRef;
  injector?: Injector;
  id?: string;

  /**
   * The element or event the overlay was opened from. Used as the anchor reference
   * for anchored positioning and as the transform origin for strategy animations.
   * When omitted and strategies are used, falls back to the currently focused element.
   */
  origin?: HTMLElement | Event;

  role?: OverlayRole;
  hasBackdrop?: boolean;
  disableClose?: boolean;

  /**
   * Bindings applied to the overlay component, using Angular's native binding API
   * (`inputBinding`, `outputBinding`, `twoWayBinding`).
   */
  bindings?: Binding[];

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

  /**
   * Breakpoint-driven overlay strategies (dialog, sheets, full-screen, …).
   * When set, position, sizing and classes are controlled by the active strategy.
   */
  strategies?: () => OverlayStrategyBreakpoint[];

  /**
   * Disables the default overlay animations so custom ones can be applied.
   *
   * @default false
   */
  customAnimated?: boolean;
};
