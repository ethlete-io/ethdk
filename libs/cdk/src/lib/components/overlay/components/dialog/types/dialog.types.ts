import { Direction } from '@angular/cdk/bidi';
import { PositionStrategy, ScrollStrategy } from '@angular/cdk/overlay';
import { Injector, ViewContainerRef } from '@angular/core';

/**
 * @deprecated Will be removed in v5.
 */
export type DialogAutoFocusTarget = 'dialog' | 'first-tabbable' | 'first-heading';

/**
 * @deprecated Will be removed in v5.
 */
export type DialogRole = 'dialog' | 'alertdialog';

/**
 * @deprecated Will be removed in v5.
 */
export interface DialogPosition {
  /** Override for the dialog's top position. */
  top?: string;

  /** Override for the dialog's bottom position. */
  bottom?: string;

  /** Override for the dialog's left position. */
  left?: string;

  /** Override for the dialog's right position. */
  right?: string;
}

/**
 * @deprecated Will be removed in v5.
 */
export interface LegacyDialogAnimationEvent {
  state: 'opened' | 'opening' | 'closing' | 'closed';
}

/**
 * @deprecated Will be removed in v5.
 */
export const enum DialogState {
  OPEN,
  CLOSING,
  CLOSED,
}

/**
 * @deprecated Will be removed in v5.
 */
export interface DialogConfig<D = unknown> {
  /**
   * Where the attached component should live in Angular's *logical* component tree.
   * This affects what is available for injection and the change detection order for the
   * component instantiated inside of the dialog. This does not affect where the dialog
   * content will be rendered.
   */
  viewContainerRef?: ViewContainerRef;

  /**
   * Injector used for the instantiation of the component to be attached. If provided,
   * takes precedence over the injector indirectly provided by `ViewContainerRef`.
   */
  injector?: Injector;

  /** ID for the dialog. If omitted, a unique one will be generated. */
  id?: string;

  /**
   * The ARIA role of the dialog element.
   * @default 'dialog'
   */
  role?: DialogRole;

  /** Custom class for the overlay pane. */
  panelClass?: string | string[];

  /** Custom class for the dialog container. */
  containerClass?: string | string[];

  /** Extra CSS classes to be added to the dialog overlay container. */
  overlayClass?: string | string[];

  /**
   * Whether the dialog has a backdrop.
   * @default true
   */
  hasBackdrop?: boolean;

  /** Custom class for the backdrop. */
  backdropClass?: string | string[];

  /**
   * Whether the user can use escape or clicking on the backdrop to close the modal.
   * @default false
   */
  disableClose?: boolean;

  /** Width of the dialog. */
  width?: string;

  /** Height of the dialog. */
  height?: string;

  /** Min-width of the dialog. If a number is provided, assumes pixel units. */
  minWidth?: number | string;

  /** Min-height of the dialog. If a number is provided, assumes pixel units. */
  minHeight?: number | string;

  /**
   * Max-width of the dialog. If a number is provided, assumes pixel units.
   * @default 80vw
   */
  maxWidth?: number | string;

  /** Max-height of the dialog. If a number is provided, assumes pixel units. */
  maxHeight?: number | string;

  /** Position overrides. */
  position?: DialogPosition;

  /**
   * Data being injected into the child component.
   * @default null
   */
  data?: D | null;

  /** Layout direction for the dialog's content. */
  direction?: Direction;

  /**
   * ID of the element that describes the dialog.
   * @default null
   */
  ariaDescribedBy?: string | null;

  /**
   * ID of the element that labels the dialog.
   * @default null
   */
  ariaLabelledBy?: string | null;

  /**
   * Aria label to assign to the dialog element.
   * @default null
   */
  ariaLabel?: string | null;

  /**
   * Whether this is a modal dialog. Used to set the `aria-modal` attribute.
   * @default true
   */
  ariaModal?: boolean;

  /**
   * Whether the dialog uses a custom animation.
   * @default false
   */
  customAnimated?: boolean;

  /**
   * Where the dialog should focus on open.
   * Can be one of AutoFocusTarget, or a css selector string.
   * @default 'first-tabbable'
   */
  autoFocus?: DialogAutoFocusTarget | string;

  /**
   * Whether the dialog should restore focus to the
   * previously-focused element, after it's closed.
   * @default true
   */
  restoreFocus?: boolean;

  /**
   * Whether to wait for the opening animation to finish before trapping focus.
   * @default true
   */
  delayFocusTrap?: boolean;

  /** Scroll strategy to be used for the dialog. */
  scrollStrategy?: ScrollStrategy;

  /** Position strategy to be used for the dialog. */
  positionStrategy?: PositionStrategy;

  /**
   * Whether the dialog should close when the user goes backwards/forwards in history.
   * Note that this usually doesn't include clicking on links (unless the user is using
   * the `HashLocationStrategy`).
   * @default true
   */
  closeOnNavigation?: boolean;
}
