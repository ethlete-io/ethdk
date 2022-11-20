import { Direction } from '@angular/cdk/bidi';
import { ScrollStrategy } from '@angular/cdk/overlay';
import { ViewContainerRef } from '@angular/core';

export const enum BottomSheetState {
  OPEN,
  CLOSING,
  CLOSED,
}

export type BottomSheetAutoFocusTarget = 'dialog' | 'first-tabbable' | 'first-heading';

export interface LegacyBottomSheetAnimationEvent {
  state: 'opened' | 'opening' | 'closing' | 'closed';
  totalTime: number;
}

export interface BottomSheetConfig<D = unknown> {
  /** The view container to place the overlay for the bottom sheet into. */
  viewContainerRef?: ViewContainerRef;

  /** ID for the bottom sheet. If omitted, a unique one will be generated. */
  id?: string;

  /** Extra CSS classes to be added to the bottom sheet container. */
  panelClass?: string | string[];

  /** Custom class for the dialog container. */
  containerClass?: string | string[];

  /** Text layout direction for the bottom sheet. */
  direction?: Direction;

  /** Data being injected into the child component. */
  data?: D | null;

  /** Whether the bottom sheet has a backdrop. */
  hasBackdrop?: boolean;

  /** Custom class for the backdrop. */
  backdropClass?: string;

  /** Whether to wait for the opening animation to finish before trapping focus. */
  delayFocusTrap?: boolean;

  /** Whether the user can use escape or clicking outside to close the bottom sheet. */
  disableClose?: boolean;

  /** Aria label to assign to the bottom sheet element. */
  ariaLabel?: string | null;

  /** Whether this is a modal bottom sheet. Used to set the `aria-modal` attribute. */
  ariaModal?: boolean;

  /**
   * Whether the bottom sheet should close when the user goes backwards/forwards in history.
   * Note that this usually doesn't include clicking on links (unless the user is using
   * the `HashLocationStrategy`).
   */
  closeOnNavigation?: boolean;

  /**
   * Where the bottom sheet should focus on open.
   */
  autoFocus?: BottomSheetAutoFocusTarget | string;

  /**
   * Whether the bottom sheet uses a custom animation.
   */
  customAnimated?: boolean;

  /**
   * Whether the bottom sheet should restore focus to the
   * previously-focused element, after it's closed.
   */
  restoreFocus?: boolean;

  /** Scroll strategy to be used for the bottom sheet. */
  scrollStrategy?: ScrollStrategy;

  /** Enter animation duration in ms */
  enterAnimationDuration?: number;

  /** Exit animation duration in ms */
  exitAnimationDuration?: number;
}
