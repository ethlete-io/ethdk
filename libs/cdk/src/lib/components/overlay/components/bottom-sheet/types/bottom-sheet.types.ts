import { Direction } from '@angular/cdk/bidi';
import { ScrollStrategy } from '@angular/cdk/overlay';
import { ViewContainerRef } from '@angular/core';
/**
 * @deprecated Will be removed in v5.
 */
export const enum BottomSheetState {
  OPEN,
  CLOSING,
  CLOSED,
}

/**
 * @deprecated Will be removed in v5.
 */
export type BottomSheetAutoFocusTarget = 'dialog' | 'first-tabbable' | 'first-heading';

/**
 * @deprecated Will be removed in v5.
 */
export interface LegacyBottomSheetAnimationEvent {
  state: 'opened' | 'opening' | 'closing' | 'closed';
  totalTime: number;
}

/**
 * @deprecated Will be removed in v5.
 */
export interface BottomSheetConfig<D = unknown> {
  /** The view container to place the overlay for the bottom sheet into. */
  viewContainerRef?: ViewContainerRef;

  /** ID for the bottom sheet. If omitted, a unique one will be generated. */
  id?: string;

  /** Extra CSS classes to be added to the bottom sheet container. */
  panelClass?: string | string[];

  /** Custom class for the dialog container. */
  containerClass?: string | string[];

  /** Extra CSS classes to be added to the bottom sheet overlay container. */
  overlayClass?: string | string[];

  /** Text layout direction for the bottom sheet. */
  direction?: Direction;

  /**
   * Data being injected into the child component.
   * @default null
   */
  data?: D | null;

  /**
   * Whether the bottom sheet has a backdrop.
   * @default true
   */
  hasBackdrop?: boolean;

  /** Custom class for the backdrop. */
  backdropClass?: string;

  /**
   * Whether to wait for the opening animation to finish before trapping focus.
   * @default true
   */
  delayFocusTrap?: boolean;

  /**
   * Whether the user can use escape or clicking outside to close the bottom sheet.
   * @default false
   */
  disableClose?: boolean;

  /**
   * Aria label to assign to the bottom sheet element.
   * @default null
   */
  ariaLabel?: string | null;

  /**
   * Whether this is a modal bottom sheet. Used to set the `aria-modal` attribute.
   * @default true
   */
  ariaModal?: boolean;

  /**
   * Whether the bottom sheet should close when the user goes backwards/forwards in history.
   * Note that this usually doesn't include clicking on links (unless the user is using
   * the `HashLocationStrategy`).
   * @default true
   */
  closeOnNavigation?: boolean;

  /**
   * Where the bottom sheet should focus on open.
   * @default 'dialog'
   */
  autoFocus?: BottomSheetAutoFocusTarget | string;

  /**
   * Whether the bottom sheet uses a custom animation.
   * @default false
   */
  customAnimated?: boolean;

  /**
   * Whether the bottom sheet should restore focus to the
   * previously-focused element, after it's closed.
   * @default true
   */
  restoreFocus?: boolean;

  /** Scroll strategy to be used for the bottom sheet. */
  scrollStrategy?: ScrollStrategy;
}
