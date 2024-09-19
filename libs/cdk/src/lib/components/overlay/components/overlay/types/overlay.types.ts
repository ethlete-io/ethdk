import { Direction } from '@angular/cdk/bidi';
import { PositionStrategy } from '@angular/cdk/overlay';
import { Injector, StaticProvider, ViewContainerRef } from '@angular/core';
import { Breakpoint } from '@ethlete/core';
import { EmptyObject } from '@ethlete/query';

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

export interface OverlayDragToDismissConfig {
  /** Direction in which the overlay can be dragged. */
  direction: 'to-top' | 'to-bottom' | 'to-left' | 'to-right';

  /**
   * The minimum distance in pixels that the user must swipe to dismiss the overlay.
   *
   * @default 150 // 150px
   */
  minDistanceToDismiss?: number;

  /**
   * The minimum velocity in pixels per second that the user must swipe to dismiss the overlay.
   *
   * @default 150 // 150px/s
   */
  minVelocityToDismiss?: number;
}

export interface OverlayBreakpointConfig {
  /** Min-width of the overlay. If a number is provided, assumes pixel units. */
  minWidth?: number | string;

  /** Max-width of the overlay. If a number is provided, assumes pixel units. */
  maxWidth?: number | string;

  /** Min-height of the overlay. If a number is provided, assumes pixel units. */
  minHeight?: number | string;

  /** Max-height of the overlay. If a number is provided, assumes pixel units. */
  maxHeight?: number | string;

  /** Width of the overlay. */
  width?: number | string;

  /** Height of the overlay. */
  height?: number | string;

  /** Position strategy to be used for the overlay. */
  positionStrategy?: () => PositionStrategy;

  /** Custom class for the overlay container. */
  containerClass?: string | string[];

  /** Custom class for the overlay pane. */
  paneClass?: string | string[];

  /** Extra CSS classes to be added to the overlay overlay container. */
  overlayClass?: string | string[];

  /** Custom class for the backdrop. */
  backdropClass?: string | string[];

  /** Custom class for the document (`<html>` element). */
  documentClass?: string | string[];

  /** Custom class for the `<body>` element */
  bodyClass?: string | string[];

  /** Position overrides. */
  position?: OverlayPosition;

  /** Determine if and in what direction the overlay should be able to be dragged to dismiss it. */
  dragToDismiss?: OverlayDragToDismissConfig;

  /**
   * Whether the transform origin should be set using the config's `origin` property value.
   *
   * @default false
   */
  applyTransformOrigin?: boolean;
}

export interface OverlayBreakpointConfigEntry {
  /**
   * Breakpoint to apply the config for. If a number is provided, it will be used as a pixel value.
   * Always uses the min-width media query.
   *
   * @default 'xs' // 0px
   */
  breakpoint?: Breakpoint | number;

  /**
   * Overlay configuration to be applied when the breakpoint is active.
   */
  config: OverlayBreakpointConfig;
}

export interface OverlayConfig<D = unknown> {
  /**
   * Conditionally applied overlay configurations based on breakpoints.
   */
  positions: OverlayBreakpointConfigEntry[];

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

  /**
   * Whether the overlay has a backdrop.
   * @default true
   */
  hasBackdrop?: boolean;

  /**
   * Whether the user can use escape or clicking on the backdrop to close the modal.
   * @default false
   */
  disableClose?: boolean;

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

  /**
   * Whether the overlay should close when the user goes backwards/forwards in history.
   * Note that this usually doesn't include clicking on links (unless the user is using
   * the `HashLocationStrategy`). Will be automatically set to false if the overlay contains a overlay router.
   * @default true
   */
  closeOnNavigation?: boolean;

  /**
   * Extra providers to be made available to the overlay.
   *
   * **WARNING**: Avoid providing `@Injectable()` classes such as services here, as they will never be destroyed.
   * This could lead to memory leaks over time.
   */
  providers?: StaticProvider[];

  /**
   * The origin element that triggered the overlay's opening.
   */
  origin?: HTMLElement | MouseEvent | TouchEvent | KeyboardEvent | PointerEvent;
}

/**
 * Configuration utility type for overlays.
 * To be used inside your overlay opener method as a param to be passed to the overlay.open method.
 */
export type OverlayConsumerConfig<D = void> = Omit<OverlayConfig<D>, 'positions' | 'data'> &
  MaybeOverlayConsumerConfigWithData<D>;

export type MaybeOverlayConsumerConfigWithData<D> = D extends void ? EmptyObject : { data: D };
