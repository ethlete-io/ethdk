import { Direction } from '@angular/cdk/bidi';
import { PositionStrategy, ScrollStrategy } from '@angular/cdk/overlay';
import { Injector, ViewContainerRef } from '@angular/core';

/** Options for where to set focus to automatically on overlay open */
export type OverlayAutoFocusTarget = 'dialog' | 'first-tabbable' | 'first-heading';

/** Valid ARIA roles for a overlay element. */
export type OverlayRole = 'dialog' | 'alertdialog';

/** Possible overrides for a overlay's position. */
export interface OverlayPosition {
  /** Override for the overlay's top position. */
  top?: string;

  /** Override for the overlay's bottom position. */
  bottom?: string;

  /** Override for the overlay's left position. */
  left?: string;

  /** Override for the overlay's right position. */
  right?: string;
}

export const OVERLAY_STATE = {
  OPEN: 'open',
  CLOSING: 'closing',
  CLOSED: 'closed',
} as const;

export type OverlayState = (typeof OVERLAY_STATE)[keyof typeof OVERLAY_STATE];

export interface OverlayConfig<D = unknown> {
  /**
   * Where the attached component should live in Angular's *logical* component tree.
   * This affects what is available for injection and the change detection order for the
   * component instantiated inside of the overlay. This does not affect where the overlay
   * content will be rendered.
   */
  viewContainerRef?: ViewContainerRef;

  /**
   * Injector used for the instantiation of the component to be attached. If provided,
   * takes precedence over the injector indirectly provided by `ViewContainerRef`.
   */
  injector?: Injector;

  /** ID for the overlay. If omitted, a unique one will be generated. */
  id?: string;

  /**
   * The ARIA role of the overlay element.
   * @default 'dialog'
   */
  role?: OverlayRole;

  /** Custom class for the overlay pane. */
  panelClass?: string | string[];

  /** Custom class for the overlay container. */
  containerClass?: string | string[];

  /** Extra CSS classes to be added to the overlay overlay container. */
  overlayClass?: string | string[];

  /**
   * Whether the overlay has a backdrop.
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

  /** Width of the overlay. */
  width?: string;

  /** Height of the overlay. */
  height?: string;

  /** Min-width of the overlay. If a number is provided, assumes pixel units. */
  minWidth?: number | string;

  /** Min-height of the overlay. If a number is provided, assumes pixel units. */
  minHeight?: number | string;

  /**
   * Max-width of the overlay. If a number is provided, assumes pixel units.
   * @default 80vw
   */
  maxWidth?: number | string;

  /** Max-height of the overlay. If a number is provided, assumes pixel units. */
  maxHeight?: number | string;

  /** Position overrides. */
  position?: OverlayPosition;

  /**
   * Data being injected into the child component.
   * @default null
   */
  data?: D | null;

  /** Layout direction for the overlay's content. */
  direction?: Direction;

  /**
   * ID of the element that describes the overlay.
   * @default null
   */
  ariaDescribedBy?: string | null;

  /**
   * ID of the element that labels the overlay.
   * @default null
   */
  ariaLabelledBy?: string | null;

  /**
   * Aria label to assign to the overlay element.
   * @default null
   */
  ariaLabel?: string | null;

  /**
   * Whether this is a modal overlay. Used to set the `aria-modal` attribute.
   * @default true
   */
  ariaModal?: boolean;

  /**
   * Whether the overlay uses a custom animation.
   * @default false
   */
  customAnimated?: boolean;

  /**
   * Where the overlay should focus on open.
   * Can be one of AutoFocusTarget, or a css selector string.
   * @default 'first-tabbable'
   */
  autoFocus?: OverlayAutoFocusTarget | string;

  /**
   * Whether the overlay should restore focus to the
   * previously-focused element, after it's closed.
   * @default true
   */
  restoreFocus?: boolean;

  /**
   * Whether to wait for the opening animation to finish before trapping focus.
   * @default true
   */
  delayFocusTrap?: boolean;

  /** Scroll strategy to be used for the overlay. */
  scrollStrategy?: ScrollStrategy;

  /** Position strategy to be used for the overlay. */
  positionStrategy?: PositionStrategy;

  /**
   * Whether the overlay should close when the user goes backwards/forwards in history.
   * Note that this usually doesn't include clicking on links (unless the user is using
   * the `HashLocationStrategy`).
   * @default true
   */
  closeOnNavigation?: boolean;
}
